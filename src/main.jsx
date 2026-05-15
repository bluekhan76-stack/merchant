import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Amplify } from "aws-amplify";
import './index.css'
import App from './App.jsx'
import { cognitoConfig } from "./auth/cognitoConfig";

Amplify.configure(cognitoConfig);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
