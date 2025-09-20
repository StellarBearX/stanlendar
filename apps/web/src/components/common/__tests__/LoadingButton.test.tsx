import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoadingButton, SaveButton, DeleteButton, SubmitButton, CancelButton } from '../LoadingButton';

describe('LoadingButton', () => {
  it('should render children when not loading', () => {
    render(<LoadingButton>Click me</LoadingButton>);
    
    expect(screen.getByText('Click me')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /loading/i })).not.toBeInTheDocument();
  });

  it('should show loading spinner and text when loading', () => {
    render(
      <LoadingButton loading loadingText="Processing...">
        Click me
      </LoadingButton>
    );
    
    expect(screen.getByText('Processing...')).toBeInTheDocument();
    expect(screen.queryByText('Click me')).not.toBeInTheDocument();
    
    // Check for loading spinner (svg element)
    const spinner = screen.getByRole('button').querySelector('svg');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
  });

  it('should show original text with spinner when no loadingText provided', () => {
    render(<LoadingButton loading>Click me</LoadingButton>);
    
    expect(screen.getByText('Click me')).toBeInTheDocument();
    
    const spinner = screen.getByRole('button').querySelector('svg');
    expect(spinner).toBeInTheDocument();
  });

  it('should be disabled when loading', () => {
    render(<LoadingButton loading>Click me</LoadingButton>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<LoadingButton disabled>Click me</LoadingButton>);
    
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
  });

  it('should handle click events when not loading', () => {
    const handleClick = jest.fn();
    render(<LoadingButton onClick={handleClick}>Click me</LoadingButton>);
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('should not handle click events when loading', () => {
    const handleClick = jest.fn();
    render(
      <LoadingButton loading onClick={handleClick}>
        Click me
      </LoadingButton>
    );
    
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('should apply primary variant styles by default', () => {
    render(<LoadingButton>Click me</LoadingButton>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-blue-600', 'text-white');
  });

  it('should apply secondary variant styles', () => {
    render(<LoadingButton variant="secondary">Click me</LoadingButton>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-white', 'text-gray-900');
  });

  it('should apply danger variant styles', () => {
    render(<LoadingButton variant="danger">Click me</LoadingButton>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-600', 'text-white');
  });

  it('should apply ghost variant styles', () => {
    render(<LoadingButton variant="ghost">Click me</LoadingButton>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-transparent', 'text-gray-700');
  });

  it('should apply medium size styles by default', () => {
    render(<LoadingButton>Click me</LoadingButton>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-4', 'py-2', 'text-sm');
  });

  it('should apply small size styles', () => {
    render(<LoadingButton size="sm">Click me</LoadingButton>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-3', 'py-2', 'text-sm');
  });

  it('should apply large size styles', () => {
    render(<LoadingButton size="lg">Click me</LoadingButton>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-6', 'py-3', 'text-base');
  });

  it('should apply custom className', () => {
    render(<LoadingButton className="custom-class">Click me</LoadingButton>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('should forward other props to button element', () => {
    render(
      <LoadingButton data-testid="custom-button" type="submit">
        Click me
      </LoadingButton>
    );
    
    const button = screen.getByTestId('custom-button');
    expect(button).toHaveAttribute('type', 'submit');
  });
});

describe('Specialized Loading Buttons', () => {
  it('should render SaveButton with correct defaults', () => {
    render(<SaveButton loading>Save</SaveButton>);
    
    expect(screen.getByText('Saving...')).toBeInTheDocument();
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-blue-600'); // primary variant
  });

  it('should render DeleteButton with correct defaults', () => {
    render(<DeleteButton loading>Delete</DeleteButton>);
    
    expect(screen.getByText('Deleting...')).toBeInTheDocument();
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-red-600'); // danger variant
  });

  it('should render SubmitButton with correct defaults', () => {
    render(<SubmitButton loading>Submit</SubmitButton>);
    
    expect(screen.getByText('Submitting...')).toBeInTheDocument();
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('type', 'submit');
    expect(button).toHaveClass('bg-blue-600'); // primary variant
  });

  it('should render CancelButton with correct defaults', () => {
    render(<CancelButton>Cancel</CancelButton>);
    
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-transparent'); // ghost variant
  });

  it('should allow overriding specialized button props', () => {
    render(<SaveButton size="lg" className="custom">Save</SaveButton>);
    
    const button = screen.getByRole('button');
    expect(button).toHaveClass('px-6', 'py-3', 'custom');
  });
});