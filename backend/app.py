from openai import AzureOpenAI
from model import extract_content_based_on_query
import json
from typing import Dict
from rag_data_processing import extact_content_embedding_from_file
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceNotFoundError
import os
from fastapi import FastAPI, File, UploadFile, Form, HTTPException
from fastapi import FastAPI, HTTPException, Depends, Form
from fastapi.responses import StreamingResponse
from rag_data_processing import CONNECTION_STRING, CONTAINER_NAME
from pydantic import BaseModel
import time 
from typing import List
import shutil
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
import os
import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
import asyncio
import mysql.connector
from mysql.connector import Error
import base64


chat_client = AzureOpenAI(
  azure_endpoint = "https://openainstance001.openai.azure.com/", 
  api_key="f619d2d04b4f44d28708e4c391039d01",  
  api_version="2024-03-01-preview"
)


gpt4_chat_client = AzureOpenAI(
  azure_endpoint = "https://openainstance001.openai.azure.com/", 
  api_key="f619d2d04b4f44d28708e4c391039d01",  
  api_version="2024-05-01-preview"
)

# Database connection function
def create_connection(host_name, user_name, user_password, db_name):
    connection = None
    try:
        connection = mysql.connector.connect(
            host=host_name,
            user=user_name,
            passwd=user_password,
            database=db_name,
            ssl_ca='./DigiCertGlobalRootG2.crt.pem'
        )
        print("Connection to MySQL DB successful")
    except Error as e:
        print("1211111111111111111111")
        print(f"The error '{e}' occurred")
    return connection

# Connection details
host_name = "mysqlai.mysql.database.azure.com"
user_name = "azureadmin"
user_password = "Meridian@123"
db_name = "chatbot"

def sucess_response(result):
    response = {
        'status': 'true',
        'code': 200,
        'message': "response generated successfully",
        'response': result
    }
    return response



def failed_response(result):
    response = {
        'status': 'False',
        'code': 400,
        'message': "Something went wrong ",
        'response': result
    }
    return response


def language_correct_query(query, history):
    message = [
        {"role": "system", "content": "You are an AI assistant that helps to identify and extract the language, fixes the typing error, change the any language into english language content and identifies the scope of banking and finance related query. Give the response in JSON."},
        {"role": "user", "content": f"Your task is to helps to identify and extract the language of query string, fixes the typing error, change the any language into english language content and identify whether the query along with history is not related to bank data. Give the response always in the json format only. \n\nInput Content : {query}\n\nHistory : {history}\n\nImportant instructions: \n1. Your task is to identify the language of content.(e.g. : english/french/..)\n2. You have to generate the modified content by fixing the typing error and change the language of input content into english language if it is other than english language content.\n3. Check the input query and history and decide if the input query is not related to banking, finance and insuarance(i.e. BFSI sector) give the value of 'scope' key False.\n4. If value of scope is 'False' then key 'Modified Content' value should be 'The given query is out of scope from our database' in the language of 'Language' key. \n5. Always give the output response in json format.\n\nKey Entities for the json response: \n1. Language\n2. Modified Content\n3. scope\n\nExtracted Json Response :"}
    ]

    response = chat_client.chat.completions.create(
      model="gpt4preview", # model = "deployment_name"
      messages = message,
      temperature=0.7,
      max_tokens=100,
      top_p=0.95,
      frequency_penalty=0,
      presence_penalty=0,
      stop=None,
      response_format = {"type": "json_object"}

    )
    json_response = response.choices[0].message.content
    return json_response


def check_follow_up(current_query, previous_query, previous_answer):
    message = [
        {"role": "system", "content": "You are an AI assistant that helps to identify the follow up query if yes then changes the current query accordingly. Give the response in JSON."},
        {"role": "user", "content": f"Your task is to helps to identify the query string whether it is follow up query or not by analysing the current query, previous query and previous result. If the current query is the follow up query then change the question of current query according to previous query. Give the response always in the json format only. \n\nCurrent query : {current_query}\n\nPrevious query : {previous_query}\n\nPrevious answer : {previous_answer}\n\n Keys for the json response : Output_query\n\nImportant instructions: \n1. Your task is to identify the query whether it is follow up or direct if input query is follow up.\n2. If the current query is not the follow up query then you have to give the output as the same input current query.\n3. If input query is follow up query then you have to change the query according to history and current query. \n\nExtracted Json Response :"}
    ]

    response = chat_client.chat.completions.create(
      model="gpt4preview", # model = "deployment_name"
      messages = message,
      temperature=0.7,
      max_tokens=100,
      top_p=0.95,
      frequency_penalty=0,
      presence_penalty=0,
      stop=None,
      response_format = {"type": "json_object"}
    )
    # Loading the response as a JSON object
    response = response.choices[0].message.content
    print(response)
    return response


# Define the query request model
class QueryRequest(BaseModel):
    query_string: str
    conversation_id : int


class DownloadRequest(BaseModel):
    folder_name: str

def background_task(folder_path: str):
    # Simulate a long-running task
    _ = extact_content_embedding_from_file(folder_path)


def download_blobs_from_folder(container_name, folder_name, connection_string, local_download_path):
    blob_service_client = BlobServiceClient.from_connection_string(connection_string)
    container_client = blob_service_client.get_container_client(container_name)
    folder_path = os.path.join(local_download_path, folder_name)
    
    # Create local download path if it doesn't exist
    if not os.path.exists(folder_path):
        os.makedirs(folder_path)
    
    blob_list = container_client.list_blobs(name_starts_with=folder_name)
    csv_blobs = [blob for blob in blob_list if blob.name.endswith('.csv')]
    
    if not csv_blobs:
        #print("No .csv files found in the folder.")
        return False

    for blob in csv_blobs:
        blob_client = container_client.get_blob_client(blob.name)
        local_file_path = os.path.join(folder_path, os.path.relpath(blob.name, folder_name))
        
        # Create directories if they don't exist
        local_dir = os.path.dirname(local_file_path)
        if not os.path.exists(local_dir):
            os.makedirs(local_dir)
        
        with open(local_file_path, "wb") as download_file:
            download_file.write(blob_client.download_blob().readall())
        #print(f"Downloaded {blob.name} to {local_file_path}")
    
    return True


# Function to store data in a JSON file
def store_data(file_path, data):
    with open(file_path, 'w') as file:
        json.dump(data, file, indent=4)


# Function to get data from a JSON file
def get_data(file_path):
    if not os.path.exists(file_path):
        return {"chat": []}  # Return an empty structure if the file does not exist
    with open(file_path, 'r') as file:
        return json.load(file)


# Function to append data to a JSON file
def append_data(file_path, new_data):
    # Load existing data
    data = get_data(file_path)
    print("a")
    # Append the new data
    data['chat'].append(new_data)
    print("ab")
    # Store the updated data
    store_data(file_path, data)




async def respond_to_question(original_query_string, conversation_id):
    try:
                # Create connection
        connection = create_connection(host_name, user_name, user_password, db_name)
        cursor = connection.cursor(dictionary=True)
        try:
            # Step 1: Update progress to 15%
            query = "UPDATE km_progress SET progress_percent = %s WHERE user_id = %s"
            cursor.execute(query, (0, conversation_id))
            connection.commit()  
        except:
            pass          
        folder_name = "BFSI_demo_data" # Add the database path  here
        # if csv not present
        current_working_directory = os.getcwd()
        print("1")
        db_path = os.path.join(current_working_directory, folder_name)
        if not os.path.exists(db_path):
            result = download_blobs_from_folder(CONTAINER_NAME, folder_name, CONNECTION_STRING, current_working_directory)
            if result == False:
                yield "Data Base not created yet"
                return
        cursor = connection.cursor(dictionary=True)
        try:
            # Step 1: Update progress to 15%
            query = "UPDATE km_progress SET progress_percent = %s WHERE user_id = %s"
            cursor.execute(query, (15, conversation_id))
            connection.commit()  
        except:
            pass          
        print("2")
        # Data Fetching 
        json_path = f'chat_history/{conversation_id}_chat_history.json'
        json_object = get_data(json_path)
        print("33")
        if len(json_object["chat"]) != 0 : 
            history = json_object["chat"][-1]["user_query"] 
        else:
            history = " " 
        print("history", history)  
        # Data Injection        
        # This function should already exist with the required logic
        language_response = language_correct_query(original_query_string, history)
        try:
            # Step 1: Update progress to 15%
            query = "UPDATE km_progress SET progress_percent = %s WHERE user_id = %s"
            cursor.execute(query, (30, conversation_id))
            connection.commit()  
        except:
            pass         
        language_response = json.loads(language_response)
        print(language_response)
        if language_response["scope"] == False:
            output_response = {"bot_answer": language_response["Modified Content"] , "citation_dict": []}   
            response =  output_response["bot_answer"]
            yield response  
            return               
        query_string_old = language_response["Modified Content"] 
        previous_answer = " "
        query_string = check_follow_up(query_string_old, history, previous_answer)
        try:
            # Step 1: Update progress to 15%
            query = "UPDATE km_progress SET progress_percent = %s WHERE user_id = %s"
            cursor.execute(query, (45, conversation_id))
            connection.commit()  
        except:
            pass         
        query_string = json.loads(query_string)
        print(query_string)
        query_string = query_string["Output_query"]
        content_list, citation_dict = extract_content_based_on_query(query_string, 10,folder_name)
        try:
            # Step 1: Update progress to 15%
            query = "UPDATE km_progress SET progress_percent = %s WHERE user_id = %s"
            cursor.execute(query, (60, conversation_id))
            connection.commit()  
        except:
            pass          
        content = " ".join(content_list)
        print(content)
        query = query_string
        language = language_response["Language"].strip().lower()
        message = [
            {"role": "system", "content": f"You are an AI assistant that helps to answer the questions from the given content in {language} language."},
            {"role": "user", "content": f"""Your task is to follow chain of thought method to extract accurate answer for given user query, chat history and provided input content. Then change the language of response into {language} language. \n\nInput Content : {content} \n\nUser Query : {query}\n\nChat History : {history}\n\nImportant Points while generating response:\n1. The answer of the question should be relevant to the input text.\n2. Answer complexity would be based on input content.\n3. If input content is not provided direct the user to provide content.\n4. Answers should not be harmful or spam.  \n\nBot answer:"""}
        ]

        responses = gpt4_chat_client.chat.completions.create(
        model="gpt4", # model = "deployment_name"
        messages = message,
        temperature=0.7,
        max_tokens=400,
        top_p=0.95,
        frequency_penalty=0,
        presence_penalty=0,
        stop=None,
        stream= True
        )
        cumulative_response = ""
        for response in responses:
            if len(response.choices) > 0:
                content = response.choices[0].delta.content   
                if content is not None:
                    print(content)                           
                    cumulative_response += content                          
                    yield cumulative_response
        # original_query_string = original_query_string.encode('utf-8').decode('unicode_escape')
        # cumulative_response = cumulative_response.encode('utf-8').decode('unicode_escape')           
        output_response = {"user_query": original_query_string, "bot_response":cumulative_response }            
        append_data(f'chat_history/{conversation_id}_chat_history.json', output_response)            
        try:
            # Step 1: Update progress to 15%
            query = "UPDATE km_progress SET progress_percent = %s WHERE user_id = %s"
            cursor.execute(query, (100, conversation_id))
            connection.commit()  
        except:
            pass   
        # answer = get_response_from_query(query_string, content, history, language_response["Language"].strip().lower())
        # print(answer)

        # return answer
    except Exception as e:
        print(e)
        yield "Error Occured"


# Define user model
class User(BaseModel):
    User_id: int
    password: str

app = FastAPI()



origins = [
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Define request body
class QueryRequest(BaseModel):
    original_query_string: str
    conversation_id: str



@app.post("/login")
async def login(User_id: int = Form(...), password: str = Form(...)):
    try:
            # Create connection
        connection = create_connection(host_name, user_name, user_password, db_name)
        cursor = connection.cursor(dictionary=True)
        query = "SELECT * FROM km_registration WHERE User_id = %s AND password = %s"
        cursor.execute(query, (User_id, password))
        user = cursor.fetchone()
        
        if user:
            return sucess_response("Login successful")
        else:
            return failed_response("Invalid credentials")
        
    except:
        return failed_response("Something went wrong in login")



@app.websocket("/query")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            query_data = QueryRequest(**data)
            original_query_string = query_data.original_query_string
            conversation_id = query_data.conversation_id
            
            # Stream response from ChatGPT API
            async for response in respond_to_question(original_query_string,conversation_id):
                await websocket.send_text(f"{response}")

    except WebSocketDisconnect:
        print("Client disconnected")


# New API endpoint to retrieve progress update using user_id
@app.get("/progress/{user_id}")
async def get_progress(user_id: str):
        # Create connection
    try:    
        connection = create_connection(host_name, user_name, user_password, db_name)
        cursor = connection.cursor(dictionary=True)
        try:
            query = "SELECT * FROM km_progress WHERE user_id = %s"
            cursor.execute(query, (user_id,))
            progress = cursor.fetchone()
    
            if progress:
                return sucess_response(progress)
            else:
                # raise HTTPException(status_code=404, detail="Progress not found for user_id: {}".format(user_id))
                return failed_response("Progress not found for user_id: {}".format(user_id))
        except Error as e:
            print(f"The error '{e}' occurred")
            # raise HTTPException(status_code=500, detail="Internal server error")
            return failed_response("Internal server error")
    except:
        return failed_response("Internal server error")


# if __name__ == "__main__":
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)