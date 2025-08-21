import React, { useEffect, useState } from 'react';
import type { Toast } from './types';
import './Toast.css';

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Show animation
    const showTimer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(showTimer);
  }, []);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => onDismiss(toast.id), 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  return (
    <div 
      className={`toast toast--${toast.type} ${isVisible ? 'toast--visible' : ''} ${isExiting ? 'toast--exiting' : ''}`}
      role="alert"
      aria-live="polite"
    >
      <div className="toast__icon">
        {getIcon()}
      </div>
      
      <div className="toast__content">
        <div className="toast__title">{toast.title}</div>
        {toast.message && (
          <div className="toast__message">{toast.message}</div>
        )}
      </div>
      
      <button 
        className="toast__dismiss" 
        onClick={handleDismiss}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
};

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="toast-container" aria-label="Notifications">
      {toasts.map(toast => (
        <ToastItem 
          key={toast.id} 
          toast={toast} 
          onDismiss={onDismiss} 
        />
      ))}
    </div>
  );
};
