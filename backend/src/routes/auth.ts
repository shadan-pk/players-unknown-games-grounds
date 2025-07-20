import express, { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';

const router = express.Router();

// Input validation helper
const validateRegistrationInput = (body: any) => {
  const errors: string[] = [];
  
  if (!body.username || body.username.trim().length < 2) {
    errors.push('Username must be at least 2 characters long');
  }
  
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Please provide a valid email address');
  }
  
  if (!body.password || body.password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }
  
  return errors;
};

const validateLoginInput = (body: any) => {
  const errors: string[] = [];
  
  if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    errors.push('Please provide a valid email address');
  }
  
  if (!body.password) {
    errors.push('Password is required');
  }
  
  return errors;
};

// Register endpoint
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    // Validate input
    const validationErrors = validateRegistrationInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }

    // Attempt registration
    const result = await AuthService.register({ 
      username: username.trim(), 
      email: email.toLowerCase().trim(), 
      password 
    });
    
    res.status(201).json({
      message: 'User registered successfully',
      user: result.user,
      token: result.token
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    
    // Handle specific errors
    if (error.message.includes('already exists')) {
      return res.status(409).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Registration failed',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Please try again later'
    });
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate input
    const validationErrors = validateLoginInput(req.body);
    if (validationErrors.length > 0) {
      return res.status(400).json({ 
        error: 'Validation failed', 
        details: validationErrors 
      });
    }

    // Attempt login
    const result = await AuthService.login({ 
      email: email.toLowerCase().trim(), 
      password 
    });
    
    res.json({
      message: 'Login successful',
      user: result.user,
      token: result.token
    });
  } catch (error: any) {
    console.error('Login error:', error);
    
    // Generic error message for security
    res.status(401).json({ 
      error: 'Invalid email or password'
    });
  }
});

// Token verification endpoint (for frontend auth checks)
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = AuthService.verifyToken(token);
    res.json({ 
      valid: true, 
      user: decoded 
    });
  } catch (error) {
    res.status(401).json({ 
      valid: false, 
      error: 'Invalid token' 
    });
  }
});

export default router;
