import React from 'react';
import { View, Text, TouchableOpacity, Modal } from 'react-native';

interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: 'red' | 'blue' | 'green';
  onConfirm: () => void;
  onCancel: () => void;
  singleButton?: boolean; // New prop to show only one button
}

export default function ConfirmDialog({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'red',
  onConfirm,
  onCancel,
  singleButton = false
}: ConfirmDialogProps) {
  
  const getConfirmButtonStyle = () => {
    switch (confirmColor) {
      case 'red':
        return 'bg-red-500';
      case 'blue':
        return 'bg-blue-500';
      case 'green':
        return 'bg-green-500';
      default:
        return 'bg-red-500';
    }
  };

  return (
    <Modal
      transparent={true}
      visible={visible}
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 bg-black bg-opacity-50 justify-center items-center p-4">
        <View className="bg-white rounded-lg p-6 w-full max-w-sm">
          <Text className="text-xl font-bold text-gray-900 mb-3">{title}</Text>
          <Text className="text-gray-700 mb-6 leading-5">{message}</Text>
          
          <View className={`flex-row ${singleButton ? 'justify-center' : 'justify-end space-x-3'}`}>
            {!singleButton && (
              <TouchableOpacity 
                onPress={onCancel}
                className="px-4 py-2 bg-gray-200 rounded-lg mr-3"
              >
                <Text className="text-gray-700 font-semibold">{cancelText}</Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              onPress={singleButton ? onConfirm : onConfirm}
              className={`px-4 py-2 ${getConfirmButtonStyle()} rounded-lg`}
            >
              <Text className="text-white font-semibold">{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
} 