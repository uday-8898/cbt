import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import clogo from './Image/clogo.png';
import bestwrk from './Image/bestwrk.png'
import './App.css';
import '@fortawesome/fontawesome-free/css/all.min.css';

// Sample questions for preliminary user details
const questions = [
  "Please provide your details: name / location / email and phone no (optional)",
];

const Chatbot = () => {
  const { t, i18n } = useTranslation();
  const [activeTab, setActiveTab] = useState('Home');
  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [visibleFAQIndex, setVisibleFAQIndex] = useState(null);
  const [isChatbotOpen, setIsChatbotOpen] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [userDetails, setUserDetails] = useState({
    name: '',
    location: '',
    email: '',
    phone: '',
  });
  const [activeService, setActiveService] = useState(false);
  const [preliminaryMessageSent, setPreliminaryMessageSent] = useState(false);
  const [isRealTimeChat, setIsRealTimeChat] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // New state for loading

  const chatEndRef = useRef(null);

  // useCallback hooks to avoid redefining functions inside useEffect
  const appendMessage = useCallback((sender, message, isStreaming = false) => {
    console.log('Appending message:', sender, message); // Debugging line

    if (isStreaming) {
      streamMessage(sender, message);
    } else {
      setMessages(prevMessages => [...prevMessages, { sender, message }]);
    }
  }, []);

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

  const handlePreliminaryQuestions = useCallback(() => {
    const questionIndex = currentQuestion;

    if (questionIndex < questions.length) {
      appendMessage('bot', t(questions[questionIndex]), true);
      setCurrentQuestion(questionIndex + 1);
    } else if (!isRealTimeChat) {
      appendMessage('bot', t("Thank you for sharing your details. Feel free to ask me anything!"), true);
      setIsRealTimeChat(true); // Activate real-time chat mode
      console.log('Real-time chat mode activated.');
      setActiveService(true);
    }
  }, [appendMessage, currentQuestion, isRealTimeChat, t]);

  useEffect(() => {
    // Update FAQ content when the language changes
    setVisibleFAQIndex(null);
    resetChat();
  }, [i18n.language]);

  useEffect(() => {
    if (isChatbotOpen) {
      if (messages.length === 0) {
        appendMessage('bot', t("Welcome to Meridian! How can I assist you today?"), true);
      } else if (!preliminaryMessageSent && messages[messages.length - 1]?.sender === 'user') {
        appendMessage('bot', t("Before we go further, I need some information from you."), true);
        setPreliminaryMessageSent(true);
      } else if (preliminaryMessageSent && messages[messages.length - 1]?.sender === 'user') {
        handlePreliminaryQuestions();
      }
    }
  }, [isChatbotOpen, messages, preliminaryMessageSent, t, appendMessage, handlePreliminaryQuestions]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  const resetChat = () => {
    setMessages([]); // Clear messages
    setPreliminaryMessageSent(false); // Reset preliminary message flag
    setIsRealTimeChat(false); // Deactivate real-time chat mode
    setCurrentQuestion(0); // Reset question index
    setUserDetails({
      name: '',
      location: '',
      email: '',
      phone: '',
    }); // Reset user details
    // Optionally you can reset any other state as required
  };

  const sendMessage = async () => {
    if (userInput.trim()) {
      const message = userInput.trim();
      appendMessage('user', message);

      if (activeService) {
        setIsLoading(true);
        try {
          const response = await fetch('https://chatbotappbackend.azurewebsites.net/query', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              original_query_string: message,
              conversation_id: '1',
            }),
          });

          if (!response.ok) {
            console.error('API request failed with status:', response.status);
            appendMessage('bot', t("Failed to send message. Please try again later."), true);
            return;
          }
          const data = await response.json();
          const botResponse = data.response?.bot_response || t("Received an unexpected response.");
          streamMessage('bot', botResponse);
          setUserInput('');
          setIsLoading(false);
          //handleAPIResponse(data);
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
    else if (currentQuestion === 2) updatedDetails.location = response;
    else if (currentQuestion === 3) updatedDetails.email = response;
    else if (currentQuestion === 4) updatedDetails.phone = response;

    setUserDetails(updatedDetails);
  };

  const handleInputChange = (e) => setUserInput(e.target.value);

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') sendMessage();
  };

  const handleFAQToggle = (index) => setVisibleFAQIndex(prevIndex => (prevIndex === index ? null : index));

  const handleLanguageChange = (e) => i18n.changeLanguage(e.target.value);

  const handleCloseChatbot = () => {
    console.log('Close button clicked'); // Debugging line
    setIsChatbotOpen(false);
  };

  return (
    <div className={`chatbot-popup ${isChatbotOpen ? 'open' : 'closed'}`}>
      <div className="chat-header">
        <img src={clogo} alt="Company Logo" />
        <img src={bestwrk} className="new-image" alt="Company Work Logo" />
        <button id="close-btn" onClick={handleCloseChatbot}>&times;</button>
      </div>
      <div className="chat-tabs">
        <button className={`tab-link ${activeTab === 'Home' ? 'active' : ''}`} onClick={() => setActiveTab('Home')}>
          {t('Home')}
        </button>
        <button className={`tab-link ${activeTab === 'Message' ? 'active' : ''}`} onClick={() => setActiveTab('Message')}>
          {t('Message')}
        </button>
        <button className={`tab-link ${activeTab === 'Help' ? 'active' : ''}`} onClick={() => setActiveTab('Help')}>
          {t('Help')}
        </button>
        <select onChange={handleLanguageChange} value={i18n.language}>
          <option value="en">English</option>
          <option value="ar">Arabic</option>
          <option value="hi">Hindi</option>
          <option value="pl">Polish</option>
          <option value="zh">Standard Chinese</option>
        </select>
      </div>
      <div id="Home" className={`tab-content ${activeTab === 'Home' ? 'active' : ''}`}>
        <h2 className="animate-text">{t('Welcome to Meridian')}</h2>
        <p className="animate-text">{t('Tier 1 vendor providing Mechanical, General Contracting, HVAC, Finishes and Marine services.')}</p>
      </div>
      <div id="Message" className={`tab-content ${activeTab === 'Message' ? 'active' : ''}`}>
        <div className="chat-box">
          <div className="message-list">
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.sender}`}>
                <div className="message-content">{msg.message}</div>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className="input-box">
            <input
              type="text"
              placeholder={t('Type your message...')}
              value={userInput}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              disabled={isLoading} // Disable input while loading
            />
            <button onClick={sendMessage} disabled={isLoading}>
              {isLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
            </button>
          </div>
        </div>
      </div>
      <div id="Help" className={`tab-content ${activeTab === 'Help' ? 'active' : ''}`}>
        <h2 className="animate-text">{t('Frequently Asked Questions')}</h2>
        <div className="faq-list">
          {[
            { question: t("What services does Meridian provide?"), answer: t("We offer a wide range of services including Mechanical, General Contracting, HVAC, Finishes, and Marine.") },
            { question: t("How can I contact Meridian?"), answer: t("You can contact us via our official website or customer service number.") },
            { question: t("Where is Meridian located?"), answer: t("Our main office is located in [Location].") },
          ].map((faq, index) => (
            <div key={index} className="faq-item">
              <div className="faq-question" onClick={() => handleFAQToggle(index)}>
                {faq.question}
              </div>
              {visibleFAQIndex === index && <div className="faq-answer">{faq.answer}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Chatbot;
