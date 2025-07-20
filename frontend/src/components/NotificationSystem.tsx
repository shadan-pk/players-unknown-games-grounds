import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, CheckCircle, AlertCircle, XCircle } from 'lucide-react';

interface NotificationProps {
  notifications: string[];
}

const NotificationSystem: React.FC<NotificationProps> = ({ notifications }) => {
  const getIcon = (message: string) => {
    if (message.includes('win') || message.includes('victory')) return <CheckCircle className="w-5 h-5 text-green-400" />;
    if (message.includes('error') || message.includes('failed')) return <XCircle className="w-5 h-5 text-red-400" />;
    if (message.includes('warning') || message.includes('disconnect')) return <AlertCircle className="w-5 h-5 text-yellow-400" />;
    return <Info className="w-5 h-5 text-blue-400" />;
  };

  const getColor = (message: string) => {
    if (message.includes('win') || message.includes('victory')) return 'border-green-400 bg-green-500/20';
    if (message.includes('error') || message.includes('failed')) return 'border-red-400 bg-red-500/20';
    if (message.includes('warning') || message.includes('disconnect')) return 'border-yellow-400 bg-yellow-500/20';
    return 'border-blue-400 bg-blue-500/20';
  };

  return (
    <div className="fixed top-20 right-4 z-50 space-y-2">
      <AnimatePresence>
        {notifications.slice(-3).map((notification, index) => (
          <motion.div
            key={`${notification}-${index}`}
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className={`max-w-sm p-4 rounded-lg border backdrop-blur-sm ${getColor(notification)}`}
          >
            <div className="flex items-start gap-3">
              {getIcon(notification)}
              <div className="flex-1 text-white text-sm">
                {notification}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default NotificationSystem;
