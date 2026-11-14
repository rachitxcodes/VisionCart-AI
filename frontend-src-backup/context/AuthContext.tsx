import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (authData: AuthResponse) => void;
  logout: () => void;
  isAdmin: boolean;
  isCashier: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('visioncart_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('visioncart_token');
  });

  useEffect(() => {
    if (token && user) {
      localStorage.setItem('visioncart_token', token);
      localStorage.setItem('visioncart_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('visioncart_token');
      localStorage.removeItem('visioncart_user');
    }
  }, [token, user]);

  const login = (authData: AuthResponse) => {
    setToken(authData.access_token);
    setUser(authData.user);
    localStorage.setItem('visioncart_token', authData.access_token);
    localStorage.setItem('visioncart_user', JSON.stringify(authData.user));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('visioncart_token');
    localStorage.removeItem('visioncart_user');
  };

  const isAdmin = user?.role === 'ADMIN';
  const isCashier = user?.role === 'CASHIER';

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isAdmin, isCashier }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

