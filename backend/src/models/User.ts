import { pool } from '../config/database';
import bcrypt from 'bcrypt';

export interface User {
  id: string;
  username: string;
  email: string;
  created_at: Date;
  last_login?: Date;
}

export interface CreateUserData {
  username: string;
  email: string;
  password: string;
}

export class UserModel {
  static async create(userData: CreateUserData): Promise<User> {
    const { username, email, password } = userData;
    const passwordHash = await bcrypt.hash(password, 12);
    
    const query = `
      INSERT INTO users (username, email, password_hash)
      VALUES ($1, $2, $3)
      RETURNING id, username, email, created_at
    `;
    
    const result = await pool.query(query, [username, email, passwordHash]);
    return result.rows[0];
  }

  static async findByEmail(email: string): Promise<any> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    return result.rows[0];
  }

  static async findById(id: string): Promise<User | null> {
    const query = 'SELECT id, username, email, created_at, last_login FROM users WHERE id = $1';
    const result = await pool.query(query, [id]);
    return result.rows[0] || null;
  }

  static async updateLastLogin(id: string): Promise<void> {
    const query = 'UPDATE users SET last_login = NOW() WHERE id = $1';
    await pool.query(query, [id]);
  }

  static async verifyPassword(email: string, password: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(query, [email]);
    const user = result.rows[0];

    if (user && await bcrypt.compare(password, user.password_hash)) {
      const { password_hash, ...userWithoutPassword } = user;
      return userWithoutPassword;
    }
    return null;
  }
}
