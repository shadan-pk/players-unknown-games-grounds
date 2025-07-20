import jwt from 'jsonwebtoken';
import { UserModel, CreateUserData, User } from '../models/User';

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User;
  token: string;
}

export class AuthService {
  static async register(userData: CreateUserData): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await UserModel.findByEmail(userData.email);
    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    const user = await UserModel.create(userData);
    const token = this.generateToken(user);

    return { user, token };
  }

  static async login(credentials: LoginData): Promise<AuthResult> {
    const user = await UserModel.verifyPassword(credentials.email, credentials.password);
    if (!user) {
      throw new Error('Invalid email or password');
    }

    await UserModel.updateLastLogin(user.id);
    const token = this.generateToken(user);

    return { user, token };
  }

  static generateToken(user: User): string {
    return jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
  }

  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, process.env.JWT_SECRET!);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}
