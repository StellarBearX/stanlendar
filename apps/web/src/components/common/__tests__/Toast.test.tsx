import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ToastProvider, useToast, useSuccessToast, useErrorToast } from '../Toast';

// Test component that uses toast hooks
const TestComponent = () => {
  const { addToast, removeToast, clearAllToasts } = useToast();
  const successToast = useSuccessToast();
  const errorToast = useErrorToast();

  return (
    <div>
      <button
        onClick={() => addToast({
          type: 'info',
          title: 'Test Toast',
          message: 'This is a test message',
        })}
        data-testid="add-toast"
      >
        Add Toast
      </button>
      
      <button
        onClick={() => successToast('Success!', 'Operation completed')}
        data-testid="success-toast"
      >
        Success Toast
      </button>
      
      <button
        onClick={() => errorToast('Error!', 'Something went wrong')}
        data-testid="error-toast"
      >
        Error Toast
      </button>
      
      <button
        onClick={() => addToast({
          type: 'warning',
          title: 'Warning',
          message: 'This is a warning',
          action: {
            label: 'Action',
            onClick: () => console.log('Action clicked'),
          },
        })}
        data-testid="action-toast"
      >
        Action Toast
      </button>
      
      <button
        onClick={clearAllToasts}
        data-testid="clear-all"
      >
        Clear All
      </button>
    </div>
  );
};

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <ToastProvider>
      {component}
    </ToastProvider>
  );
};

describe('Toast System', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render toast when added', () => {
    renderWithProvider(<TestComponent />);

    fireEvent.click(screen.getByTestId('add-toast'));

    expect(screen.getByText('Test Toast')).toBeInTheDocument();
    expect(screen.getByText('This is a test message')).toBeInTheDocument();
  });

  it('should render success toast with correct styling', () => {
    renderWithProvider(<TestComponent />);

    fireEvent.click(screen.getByTestId('success-toast'));

    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Operation completed')).toBeInTheDocument();
    
    // Check for success icon (CheckCircle)
    const successIcon = screen.getByText('Success!').closest('div')?.querySelector('svg');
    expect(successIcon).toBeInTheDocument();
  });

  it('should render error toast that does not auto-dismiss', () => {
    renderWithProvider(<TestComponent />);

    fireEvent.click(screen.getByTestId('error-toast'));

    expect(screen.getByText('Error!')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Fast-forward time - error toasts should not auto-dismiss
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('should auto-dismiss non-error toasts after duration', async () => {
    renderWithProvider(<TestComponent />);

    fireEvent.click(screen.getByTestId('add-toast'));
    expect(screen.getByText('Test Toast')).toBeInTheDocument();

    // Fast-forward past the default duration (5000ms)
    act(() => {
      jest.advanceTimersByTime(5100);
    });

    await waitFor(() => {
      expect(screen.queryByText('Test Toast')).not.toBeInTheDocument();
    });
  });

  it('should render action button and handle click', () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    renderWithProvider(<TestComponent />);

    fireEvent.click(screen.getByTestId('action-toast'));

    const actionButton = screen.getByText('Action');
    expect(actionButton).toBeInTheDocument();

    fireEvent.click(actionButton);
    expect(consoleSpy).toHaveBeenCalledWith('Action clicked');

    consoleSpy.mockRestore();
  });

  it('should close toast when close button is clicked', async () => {
    renderWithProvider(<TestComponent />);

    fireEvent.click(screen.getByTestId('add-toast'));
    expect(screen.getByText('Test Toast')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: '' }); // X button
    fireEvent.click(closeButton);

    // Wait for exit animation
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.queryByText('Test Toast')).not.toBeInTheDocument();
    });
  });

  it('should clear all toasts when clearAllToasts is called', () => {
    renderWithProvider(<TestComponent />);

    // Add multiple toasts
    fireEvent.click(screen.getByTestId('add-toast'));
    fireEvent.click(screen.getByTestId('success-toast'));
    fireEvent.click(screen.getByTestId('error-toast'));

    expect(screen.getByText('Test Toast')).toBeInTheDocument();
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('clear-all'));

    expect(screen.queryByText('Test Toast')).not.toBeInTheDocument();
    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
    expect(screen.queryByText('Error!')).not.toBeInTheDocument();
  });

  it('should limit number of toasts based on maxToasts prop', () => {
    render(
      <ToastProvider maxToasts={2}>
        <TestComponent />
      </ToastProvider>
    );

    // Add 3 toasts
    fireEvent.click(screen.getByTestId('add-toast'));
    fireEvent.click(screen.getByTestId('success-toast'));
    fireEvent.click(screen.getByTestId('error-toast'));

    // Only the 2 most recent should be visible
    expect(screen.queryByText('Test Toast')).not.toBeInTheDocument();
    expect(screen.getByText('Success!')).toBeInTheDocument();
    expect(screen.getByText('Error!')).toBeInTheDocument();
  });

  it('should handle toast entrance and exit animations', async () => {
    renderWithProvider(<TestComponent />);

    fireEvent.click(screen.getByTestId('add-toast'));
    
    const toastElement = screen.getByText('Test Toast').closest('div');
    expect(toastElement).toHaveClass('translate-x-full', 'opacity-0');

    // Wait for entrance animation
    await waitFor(() => {
      expect(toastElement).toHaveClass('translate-x-0', 'opacity-100');
    });

    // Click close button
    const closeButton = screen.getByRole('button', { name: '' });
    fireEvent.click(closeButton);

    // Should start exit animation
    await waitFor(() => {
      expect(toastElement).toHaveClass('translate-x-full', 'opacity-0');
    });
  });

  it('should throw error when useToast is used outside provider', () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    
    const TestComponentWithoutProvider = () => {
      const { addToast } = useToast();
      return <div>Test</div>;
    };

    expect(() => render(<TestComponentWithoutProvider />)).toThrow(
      'useToast must be used within a ToastProvider'
    );

    consoleSpy.mockRestore();
  });

  it('should generate unique IDs for toasts', () => {
    renderWithProvider(<TestComponent />);

    fireEvent.click(screen.getByTestId('add-toast'));
    fireEvent.click(screen.getByTestId('add-toast'));

    const toasts = screen.getAllByText('Test Toast');
    expect(toasts).toHaveLength(2);

    // Each toast should have a unique container
    const containers = toasts.map(toast => toast.closest('div'));
    expect(containers[0]).not.toBe(containers[1]);
  });
});