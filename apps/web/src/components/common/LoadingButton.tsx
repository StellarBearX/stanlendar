import React from 'react';
import { ButtonLoadingSpinner } from './LoadingSpinner';

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

export const LoadingButton: React.FC<LoadingButtonProps> = ({
  loading = false,
  loadingText,
  variant = 'primary',
  size = 'md',
  disabled,
  children,
  className = '',
  ...props
}) => {
  const getVariantStyles = () => {
    switch (variant) {
      case 'primary':
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white border-transparent';
      case 'secondary':
        return 'bg-white hover:bg-gray-50 focus:ring-blue-500 text-gray-900 border-gray-300';
      case 'danger':
        return 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white border-transparent';
      case 'ghost':
        return 'bg-transparent hover:bg-gray-100 focus:ring-gray-500 text-gray-700 border-transparent';
      default:
        return 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 text-white border-transparent';
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-2 text-sm';
      case 'md':
        return 'px-4 py-2 text-sm';
      case 'lg':
        return 'px-6 py-3 text-base';
      default:
        return 'px-4 py-2 text-sm';
    }
  };

  const isDisabled = disabled || loading;

  return (
    <button
      {...props}
      disabled={isDisabled}
      className={`
        inline-flex items-center justify-center
        border font-medium rounded-md
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors duration-200
        ${getVariantStyles()}
        ${getSizeStyles()}
        ${className}
      `}
    >
      {loading && (
        <ButtonLoadingSpinner 
          size={size === 'lg' ? 'md' : 'sm'} 
          className="mr-2" 
        />
      )}
      
      <span className={loading ? 'opacity-75' : ''}>
        {loading && loadingText ? loadingText : children}
      </span>
    </button>
  );
};

// Specialized loading buttons for common use cases
export const SaveButton: React.FC<Omit<LoadingButtonProps, 'variant'>> = (props) => (
  <LoadingButton variant="primary" loadingText="Saving..." {...props} />
);

export const DeleteButton: React.FC<Omit<LoadingButtonProps, 'variant'>> = (props) => (
  <LoadingButton variant="danger" loadingText="Deleting..." {...props} />
);

export const SubmitButton: React.FC<Omit<LoadingButtonProps, 'variant' | 'type'>> = (props) => (
  <LoadingButton variant="primary" type="submit" loadingText="Submitting..." {...props} />
);

export const CancelButton: React.FC<Omit<LoadingButtonProps, 'variant'>> = (props) => (
  <LoadingButton variant="ghost" {...props} />
);