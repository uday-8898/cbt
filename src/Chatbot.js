import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import clogo from './Image/clogo.png';
import bestwrk from './Image/bestwrk.png'
import './App.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import UserDetailsForm from './UserDetailsForm';
 
// Sample questions for preliminary user details
const questions = [
  "Please provide your details",
];

// Attach the function to the window's load event
window.onload = function() {
  localStorage.removeItem('last_two_chat_history');
  localStorage.removeItem('complete_chat_history');
};
  
const Chatbot = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('Home');
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [visibleFAQIndex, setVisibleFAQIndex] = useState(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [savedHistory, setSavedHistory] = useState(JSON.parse(localStorage.getItem('complete_chat_history')) || []);
  const [userDetails, setUserDetails] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
  });
  const [activeService, setActiveService] = useState(false)
  const [preliminaryMessageSent, setPreliminaryMessageSent] = useState(false);
  const [isRealTimeChat, setIsRealTimeChat] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // New state for loading
  const [showForm, setShowForm] = useState(false);
 
  const chatEndRef = useRef(null);
 
  // FAQs for Home and Help tabs
  const homeFAQs = [
    { question: t("What cloud services does Meridian Solutions offer?"), answer: t("Meridian Solutions provides comprehensive cloud services, including migration services, managed IT services, and custom application development. We specialize in transitioning business applications to the cloud, optimizing cloud usage, and offering proactive guidance to ensure seamless integration and performance.") },
    { question: t("How does Meridian Solutions ensure data security?"), answer: t("We prioritize data security through a multi-layered approach that includes endpoint backup solutions, secure migration services, and continuous monitoring. Our security solutions are designed to protect your data from threats and ensure compliance with industry standards.") },
    { question: t("What support options are available for clients?"), answer: t("We offer various support options, including dedicated support, incident-based support, onsite FMS support, and shared factory support. Our managed support services are tailored to meet your specific needs, ensuring reliable and efficient resolution of any issues.") },
    { question: t("What are the benefits of partnering with Meridian Solutions?"), answer: t("Partnering with Meridian Solutions offers numerous benefits, including access to a team of experts with deep technical proficiency, customized solutions tailored to your business needs, and a commitment to innovation and excellence. Our customer-centric approach ensures that we place your needs at the forefront of every solution, fostering a collaborative environment for collective success.") }
  ];
 
  const helpFAQs = [
    { question: t("How do I contact customer support?"), answer: t("You can connect with our support team using email, Toll-free number & support portal.") },
    { question: t("What are your support hours?"), answer: t("Standard support is available between 9AM to 6PM on all working days.") },
    { question: t("What types of issues does your support team handle?"), answer: t("O365, Azure & D365 related technical issues & troubleshooting support.") },
    { question: t("What languages does your support team provide assistance in?"), answer: t("We use English as a communication language for support process.") },
    { question: t("What is the average turnaround time for resolving support tickets?"), answer: t("The initial response time will 30 mins after raising support request.") },
  ];
 
  const appendMessage = useCallback((sender, message, isStreaming = false) => {
    // console.log('Appending message:', sender, message);
    
    if (isStreaming) {
      streamMessage(sender, message);
    } else {
      setMessages(prevMessages => [...prevMessages, { sender, message }]);
    }
  }, [setMessages]);
  

  const handlePreliminaryQuestions = useCallback((isInitialCall = false) => {
    const questionIndex = currentQuestion;
    if (questionIndex < questions.length) {
      setCurrentQuestion(questionIndex + 1);
    } else if (!isRealTimeChat) {
      appendMessage('bot', t("Thank you for sharing your details. Feel free to ask me anything!"), true);
      setIsRealTimeChat(true);
      setActiveService(true);
    }
  }, [currentQuestion, appendMessage, setIsRealTimeChat, setActiveService, isRealTimeChat, t]);  
  
  useEffect(() => {
    // Update FAQ content when the language changes
    setVisibleFAQIndex(null);
    resetChat();
  }, [i18n.language]);
 
  useEffect(() => {
    const checkUserResponse = async (message) => {
      setIsLoading(true);
      try {
        const response = await fetch('http://127.0.0.1:8000/submit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_input: message,
          }),
        });
  
        const data = await response.json();
        console.log("D", data)
        console.log("INtention:", data.intent)
        setIsLoading(false);
        return data.intent; // Expecting 'true', 'false'
      } catch (error) {
        console.error('Error checking user response:', error);
        return 'neutral'; // Default to neutral if there's an error
      }
    };
  
    if (isChatbotOpen) {
      if (messages.length === 0 && savedHistory.length === 0) {
        appendMessage('bot', t("Welcome to Meridian Solutions! Before we continue, may I ask for some basic information?"), true);
      } else if (!preliminaryMessageSent && messages[messages.length - 1]?.sender === 'user') {
        const userMessage = messages[messages.length - 1].message.toLowerCase();
        checkUserResponse(userMessage)
          .then(response => {
            console.log("Response:", response);
            if (response) {
              console.log("User agreed:", messages[messages.length - 1].message);
              setPreliminaryMessageSent(true);
              setShowForm(true);
            } else {
              console.log("User declined:", messages[messages.length - 1].message);
              appendMessage('bot', t("Ok, no issue. Feel free to ask me anything else!"), true);
              setPreliminaryMessageSent(true);
              setIsRealTimeChat(true); // Activate real-time chat mode
              console.log('Real-time chat mode activated.');
              setActiveService(true);
            }
          })
          .catch(error => {
            console.error("Error checking user response:", error);
            // Handle error if needed
          });
      }
    } else {
      // Logic for when the chatbot is not open
      console.log('Chatbot is closed');
      setIsChatbotOpen(false); // Reset the chat when chatbot is closed
    }
    
  }, [isChatbotOpen, setIsChatbotOpen, messages, preliminaryMessageSent, t, appendMessage, handlePreliminaryQuestions]);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]); 

  useEffect(() => {
    if (isChatbotOpen) {
      if (savedHistory.length > 0) {
        // Display saved messages
        const formattedMessages = savedHistory?.flatMap(chat => [
          { sender: 'user', message: chat.user_query },
          { sender: 'bot', message: chat.bot_response }
        ]).filter(message => message.message !== null && message.message.trim() !== '');

        // Check if the last message is from the bot and the welcome message was sent
        const lastMessage = formattedMessages[formattedMessages.length - 1];
        const hasBotResponse = lastMessage?.sender === 'bot';

        // console.log("FM:", formattedMessages)
        messages.push(formattedMessages)
        // console.log("Mlen:", messages.length)
        setMessages(formattedMessages);
        
        // Set flags based on chat history
        if (hasBotResponse) {
          setPreliminaryMessageSent(true);
          setIsRealTimeChat(true);
          setActiveService(true);
        }
        
      } else {
        // No saved history, send the welcome message
        appendMessage('bot', t("Welcome to Meridian Solutions! Before we continue, may I ask for some basic information?"), true);
      }
    }
  }, [isChatbotOpen, t, appendMessage]);
  

  const resetChat = () => {
    setMessages([]); // Clear messages
    setPreliminaryMessageSent(false); // Reset preliminary message flag
    setIsRealTimeChat(false); // Deactivate real-time chat mode
    setCurrentQuestion(0); // Reset question index
    setUserDetails({  
      name: '',
      email: '',
      phone: '',
      company: ''
    }); // Reset user details
  };
 
  const streamMessage = (sender, fullMessage) => {
    const typingSpeed = 30; // Adjust typing speed if needed
    let index = 0; // To keep track of the current character index
 
    const updateMessage = () => {
      setMessages(prevMessages => {
        const lastMessage = prevMessages[prevMessages.length - 1];
       
        if (lastMessage?.sender === sender) {
          const updatedMessage = fullMessage.slice(0, index);
          return [
            ...prevMessages.slice(0, -1),
            { ...lastMessage, message: updatedMessage } // Update with partial message
          ];
        }
       
        return [...prevMessages, { sender, message: fullMessage.slice(0, index) }];
      });
 
      if (index < fullMessage.length) {
        index += 1;
        setTimeout(updateMessage, typingSpeed);
      } else {
        setMessages(prevMessages => {
          const lastMessage = prevMessages[prevMessages.length - 1];
          if (lastMessage?.sender === sender) {
            return [
              ...prevMessages.slice(0, -1),
              { ...lastMessage, message: fullMessage } // Set final message
            ];
          }
          return [...prevMessages, { sender, message: fullMessage }];
        });
      }
    };
    updateMessage();
  };
 
  const sendMessage = async () => {
    if (userInput.trim()) {
      const message = userInput.trim();
      setUserInput('');
      appendMessage('user', message);
  
      // Prepare message histories
      let completeHistory = JSON.parse(localStorage.getItem('complete_chat_history')) || [];
      let lastTwoHistory = JSON.parse(localStorage.getItem('last_two_chat_history')) || [];
  
      // Initialize lastTwoHistory with two empty conversations if history is empty
      if (lastTwoHistory.length === 0) {
        lastTwoHistory = [
          { user_query: "", bot_response: "" },
          { user_query: "", bot_response: "" }
        ];
      }

      if(completeHistory.length === 0){
        completeHistory.push({user_query: null, bot_response: "Welcome to Meridian Solutions! Before we continue, may I ask for some basic information?"})
      }
  
      // Push the current user query to complete history and last two history
      completeHistory.push({ user_query: message, bot_response: null });
      lastTwoHistory.push({ user_query: message });
  
      // Keep only the last two conversations in lastTwoHistory
      if (lastTwoHistory.length > 2) {
        lastTwoHistory = lastTwoHistory.slice(-2);
      }
  
      localStorage.setItem('complete_chat_history', JSON.stringify(completeHistory));
      localStorage.setItem('last_two_chat_history', JSON.stringify(lastTwoHistory));
      setSavedHistory(JSON.stringify(completeHistory));
      if (activeService) {
        setIsLoading(true);
        try {
          const response = await fetch('http://127.0.0.1:8000/query', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              original_query_string: message,  // Current user query
              chat_history: lastTwoHistory     // Last two conversations
            }),
          });
  
          if (!response.ok) {
            console.error('API request failed with status:', response.status);
            appendMessage('bot', t("Failed to send message. Please try again later."), true);
            return;
          }
  
          const data = await response.json();
          // console.log("response:", data);
          const botResponse = data.response?.bot_response || t("I'm sorry, I didn't get this.");
          streamMessage('bot', botResponse);
  
          // Update the last two conversations history with bot's response
          lastTwoHistory[lastTwoHistory.length - 1].bot_response = botResponse;
  
          // Update the complete history with bot's response
          completeHistory[completeHistory.length - 1].bot_response = botResponse;
  
          // Save updated histories to localStorage
          localStorage.setItem('complete_chat_history', JSON.stringify(completeHistory));
          localStorage.setItem('last_two_chat_history', JSON.stringify(lastTwoHistory));
  
          setUserInput('');
          setIsLoading(false);
        } catch (error) {
          console.error('Error sending message to API:', error);
          appendMessage('bot', t("An error occurred while sending the message. Please try again later."), true);
          setIsLoading(false);
        }
      } else {
        setActiveService(false);
        handleUserResponse(message);
        setUserInput('');
      }
    }
  };
  
  const handleUserResponse = (response) => {
    const updatedDetails = { ...userDetails };
    if (currentQuestion === 1) updatedDetails.name = response;
    else if (currentQuestion === 2) updatedDetails.email = response;
    else if (currentQuestion === 3) updatedDetails.phone = response;
    else if (currentQuestion === 4) updatedDetails.company = response;
 
    setUserDetails(updatedDetails);
  };
 
  const handleInputChange = (e) => setUserInput(e.target.value);
 
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };
 
  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
      appendMessage('user', `${t('Uploaded file')}: ${e.target.files[0].name}`);
    }
  };
 
  const handleFormSubmit = () => {
    // appendMessage('user', JSON.stringify(userDetails));
    setShowForm(false);
    handlePreliminaryQuestions();

    // Thank the user after filling in the details and activate real-time chat mode
    appendMessage('bot', t("Thank you for sharing your details. Feel free to ask me anything!"), true);
    
    // Enable real-time chat mode
    setIsRealTimeChat(true);
    setActiveService(true);
  };
 
  const handleFAQToggle = (index) => setVisibleFAQIndex(prevIndex => (prevIndex === index ? null : index));
 
  const handleLanguageChange = (e) => i18n.changeLanguage(e.target.value);
 
  const handleCloseChatbot = () => {
    console.log('Close button clicked'); // Debugging line

    // Clear the conversation ID but keep the complete chat history
    localStorage.removeItem('conversation_id');
    localStorage.removeItem('last_two_chat_history');
    setIsChatbotOpen(false);
  };
 
  const openWebsite = () => {
    window.open('https://onmeridian.com/contact-us/', '_blank'); // Replace with your desired URL
  };
  
  return (
    <div className={`chatbot-popup ${isChatbotOpen ? 'open' : 'closed'}`}>
      <div className="chat-header">
        <img src={clogo} alt="logo" />
        <img src={bestwrk} className="new-image" alt="New" />
        <div className='call' onClick={openWebsite}></div>

        <button id="close-btn" onClick={handleCloseChatbot}>&times;</button>
      </div>
      <div className="chat-tabs">
        <button className={`tab-link ${activeTab === 'Home' ? 'active' : ''}`} onClick={() => setActiveTab('Home')}>
          {t('Home')}
        </button>
        <button className={`tab-link ${activeTab === 'Message' ? 'active' : ''}`} onClick={() => {
          setActiveTab('Message');
          setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 10);
        }}>
          {t('Message')}
        </button>
        <button className={`tab-link ${activeTab === 'Help' ? 'active' : ''}`} onClick={() => setActiveTab('Help')}>
          {t('Help')}
        </button>
        <select onChange={handleLanguageChange} value={i18n.language} className="styled-select">
          <option value="en">English</option>
          <option value="ar">Arabic</option>
          <option value="hi">Hindi</option>
          <option value="pl">Polish</option>
          <option value="zh">Chinese</option>
        </select>
      </div>
      <div id="Home" className={`tab-content ${activeTab === 'Home' ? 'active' : ''}`}>
      <h2 className="animate-text">Welcome to <span>Meridian</span></h2>
        <p className="animate-text">{t('Tier 1 Cloud Solutions Partner and Gold Certified Cloud Productivity Partner of Microsoft, we offer expert services across diverse verticals.')}</p>
        <div className="link-buttons">
        <div className="link-row">
            <a href="https://onmeridian.com/about-us/" className="link-button1">About Us</a>
            <a href="#link2" className="link-button2">Our Team</a>
        </div>
        <div className="link-row">
            <a href="https://onmeridian.com/insights/" className="link-button3">Insights</a>
            <a href="https://onmeridian.com/careers/" className="link-button4">Careers</a>
        </div>
    </div>
        <h3 className="animate-text">{t('FAQ')}</h3>
        {homeFAQs.map((faq, index) => (
          <div className="faq-section" key={index}>
          
            <button className="faq-toggle" onClick={() => handleFAQToggle(index)}>
              {faq.question}
              {visibleFAQIndex === index && <div className="progress-bar"></div>}
            </button>

            <div className="faq-content" style={{ display: visibleFAQIndex === index ? 'block' : 'none' }}>
            <div className="faq-ans">
              <p>{faq.answer}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div id="Message" className={`tab-content messagetab ${activeTab === 'Message' ? 'active' : ''}`}>
        {showForm ? <UserDetailsForm onFormSubmit={handleFormSubmit} /> : null}
        <div className="chat-box">
          {messages.map((msg, index) => (
            <div key={index} className={msg.sender === 'user' ? 'user-message' : 'bot-message'}>
              {msg.message}
            </div>
          ))}
          <div  ref={chatEndRef}/>
      </div>
 
        {isLoading && (
              <div className="loading-animation">
                {/* Add your loading animation here */}
                <div className="loader"></div>
              </div>
        )}
        <div className="chat-input">
          <input
            type="text"
            id="user-input"
            placeholder={t('Type a message...')}
            value={userInput}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
          />
          <input
            type="file"
            id="file-input"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
    
          <button id="send-btn" onClick={sendMessage}>
              <i className="fas fa-paper-plane"></i>
            </button>
        </div>
      </div>
      <div id="Help" className={`tab-content ${activeTab === 'Help' ? 'active' : ''}`}>
        <h3 className="animate-text">{t('Help')}</h3>
        {helpFAQs.map((faq, index) => (
          <div className="faq-section" key={index}>
            <button className="faq-toggle" onClick={() => handleFAQToggle(index)}>
              {t(faq.question)}
              {visibleFAQIndex === index && <div className="progress-bar"></div>}
            </button>
            <div className="faq-content" style={{ display: visibleFAQIndex === index ? 'block' : 'none' }}>
              <div className='faq-ans'>
              <p>{t(faq.answer)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
 
export default Chatbot;
