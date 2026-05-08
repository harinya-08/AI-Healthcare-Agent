An intelligent AI-powered healthcare assistant built using FastAPI, OpenAI GPT-4o, and RAG (Retrieval-Augmented Generation) to analyze medical reports, answer healthcare-related questions, and assist both patients and doctors through an interactive healthcare platform.
Features
1.  Patient Features
Patient Signup & Login
Secure JWT Authentication
Google OAuth Login
Upload Medical Reports
AI-based Medical Report Analysis
Chat with AI Medical Assistant
Health Dashboard
Appointment & Visit Tracking
Personalized Health Insights

2. Doctor Features
Doctor Signup & Login
Doctor Dashboard
Secure Doctor Authentication
Patient Health Monitoring

3. AI Medical Assistant
GPT-4o powered medical chatbot
Retrieval-Augmented Generation (RAG)
Medical report understanding
Disease explanation
Symptom guidance
Medication understanding
Context-aware conversations

4. RAG Pipeline Capabilities

The project uses a custom Medical RAG Pipeline that:

Extracts text from:
PDF files
Medical Images
DOC/DOCX files
Generates embeddings using OpenAI Embeddings API
Stores vector embeddings in memory
Retrieves relevant medical context using cosine similarity
Sends contextualized prompts to GPT-4o for intelligent responses

5. Tech Stack
Backend
FastAPI
Python
SQLAlchemy
MySQL
JWT Authentication
OAuth 2.0
AI & Machine Learning
OpenAI GPT-4o
OpenAI Embeddings
Retrieval-Augmented Generation (RAG)
NumPy
Frontend
HTML
CSS
JavaScript
Jinja2 Templates
Authentication & Security
Passlib (bcrypt hashing)
JWT Tokens
Session Middleware
Google OAuth Login

6. Installation
   1. Clone the Repository
      git clone https://github.com/harinya-08/AI-Healthcare-Agent.git
      cd AI-Healthcare-Agent
   2. Create Virtual Environment
      python -m venv .venv
      Activate virtual environment:
      Windows
      .venv\Scripts\activate
      Linux/Mac
      source .venv/bin/activate
    3. Install Dependencies
       pip install -r requirements.txt
       
       1. Environment Variables
          Create a .env file in the root directory:
          OPENAI_API_KEY=your_openai_api_key
          JWT_SECRET_KEY=your_jwt_secret
          FASTAPI_SECRET_KEY=your_fastapi_secret
          GOOGLE_CLIENT_ID=your_google_client_id
          GOOGLE_CLIENT_SECRET=your_google_client_secret
          FRONTEND_URL=http://127.0.0.1:8000
          REDIRECT_URL=http://127.0.0.1:8000/auth
          1. Database Configuration
          Update MySQL credentials in app.py:
          DATABASE_URL = "mysql+mysqlconnector://username:password@localhost/database_name"
          Create the database in MySQL:
      
      CREATE DATABASE aadithya;
      2. Running the Application
      Start the FastAPI server:
      uvicorn app:app --reload
      Application runs on:
      http://127.0.0.1:8000
      3. Supported File Uploads
      The AI assistant supports:
      PDF Reports
      Medical Images
      JPG
      PNG
      WEBP
      GIF
      DOC/DOCX Files
      Maximum file size: 20 MB
      4. AI Workflow
      User uploads medical report
      Text is extracted from file
      Text is chunked into smaller sections
      OpenAI embeddings are generated
      Similar chunks are retrieved
      GPT-4o generates medical explanation
      AI responds with contextual healthcare guidance
7. Security Features
Password Hashing using bcrypt
JWT-based Authentication
Secure Session Middleware
Google OAuth Integration
Role-based Access (Patient / Doctor)
1. API Endpoints
Authentication
/login
/signup
/login/google
/auth
/logout
Doctor
/login/doctor
/signup/doctor
/doctor-dashboard
AI Assistant
/upload
/chat
Health Dashboard
/dashboard
/api/health-data
