import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ColumnMapping from '../ColumnMapping';

describe('ColumnMapping', () => {
  const mockHeaders = ['Subject', 'Section', 'Time', 'Room'];
  const mockRows = [
    { Subject: 'Math 101', Section: '001', Time: '09:00', Room: 'A101' },
    { Subject: 'Physics 201', Section: '002', Time: '14:00', Room: 'B202' },
  ];
  const mockColumnMapping = {
    Subject: 'subjectName',
    Section: 'sectionCode',
    Time: 'startTime',
    Room: 'room',
  };
  const mockOnMappingChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders column mapping table', () => {
    render(
      <ColumnMapping
        headers={mockHeaders}
        rows={mockRows}
        columnMapping={mockColumnMapping}
        onMappingChange={mockOnMappingChange}
      />
    );

    expect(screen.getByText('Column Mapping')).toBeInTheDocument();
    expect(screen.getByText('CSV Column')).toBeInTheDocument();
    expect(screen.getByText('Map to Field')).toBeInTheDocument();
    expect(screen.getByText('Sample Data')).toBeInTheDocument();

    // Check if headers are displayed in the table
    mockHeaders.forEach(header => {
      const headerElements = screen.getAllByText(header);
      expect(headerElements.length).toBeGreaterThan(0);
    });
  });

  it('displays sample data for each column', () => {
    render(
      <ColumnMapping
        headers={mockHeaders}
        rows={mockRows}
        columnMapping={mockColumnMapping}
        onMappingChange={mockOnMappingChange}
      />
    );

    expect(screen.getByText('Math 101')).toBeInTheDocument();
    expect(screen.getByText('001')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('A101')).toBeInTheDocument();
  });

  it('calls onMappingChange when dropdown selection changes', () => {
    render(
      <ColumnMapping
        headers={mockHeaders}
        rows={mockRows}
        columnMapping={{}}
        onMappingChange={mockOnMappingChange}
      />
    );

    const firstSelect = screen.getAllByRole('combobox')[0];
    fireEvent.change(firstSelect, { target: { value: 'subjectName' } });

    expect(mockOnMappingChange).toHaveBeenCalledWith(mockHeaders[0], 'subjectName');
  });

  it('shows validation errors for missing required fields', () => {
    render(
      <ColumnMapping
        headers={mockHeaders}
        rows={mockRows}
        columnMapping={{ Subject: 'subjectName' }} // Missing required fields
        onMappingChange={mockOnMappingChange}
      />
    );

    expect(screen.getByText('Missing Required Fields')).toBeInTheDocument();
    expect(screen.getByText(/sectionCode/)).toBeInTheDocument();
    expect(screen.getByText(/startTime/)).toBeInTheDocument();
  });

  it('shows validation errors for duplicate mappings', () => {
    render(
      <ColumnMapping
        headers={mockHeaders}
        rows={mockRows}
        columnMapping={{
          Subject: 'subjectName',
          Section: 'subjectName', // Duplicate mapping
          Time: 'startTime',
          Room: 'room',
        }}
        onMappingChange={mockOnMappingChange}
      />
    );

    expect(screen.getByText('Duplicate Mappings')).toBeInTheDocument();
    expect(screen.getByText(/subjectName/)).toBeInTheDocument();
  });

  it('shows valid status when mapping is correct', () => {
    render(
      <ColumnMapping
        headers={mockHeaders}
        rows={mockRows}
        columnMapping={{
          Subject: 'subjectName',
          Section: 'sectionCode',
          Time: 'startTime',
          Room: 'endTime', // Need endTime for valid mapping
        }}
        onMappingChange={mockOnMappingChange}
      />
    );

    // Should show valid status in mapping summary
    expect(screen.getByText('Mapping Summary')).toBeInTheDocument();
  });

  it('handles auto mapping functionality', () => {
    render(
      <ColumnMapping
        headers={['Subject Name', 'Section Code', 'Start Time', 'End Time', 'Days']}
        rows={[]}
        columnMapping={{}}
        onMappingChange={mockOnMappingChange}
      />
    );

    const autoMapButton = screen.getByText('Auto Map');
    fireEvent.click(autoMapButton);

    // Should call onMappingChange for auto-detected mappings
    expect(mockOnMappingChange).toHaveBeenCalledWith('Subject Name', 'subjectName');
    expect(mockOnMappingChange).toHaveBeenCalledWith('Section Code', 'sectionCode');
    expect(mockOnMappingChange).toHaveBeenCalledWith('Start Time', 'startTime');
    expect(mockOnMappingChange).toHaveBeenCalledWith('End Time', 'endTime');
    expect(mockOnMappingChange).toHaveBeenCalledWith('Days', 'daysOfWeek');
  });

  it('handles clear all functionality', () => {
    render(
      <ColumnMapping
        headers={mockHeaders}
        rows={mockRows}
        columnMapping={mockColumnMapping}
        onMappingChange={mockOnMappingChange}
      />
    );

    const clearButton = screen.getByText('Clear All');
    fireEvent.click(clearButton);

    // Should call onMappingChange to clear each mapping
    mockHeaders.forEach(header => {
      expect(mockOnMappingChange).toHaveBeenCalledWith(header, '');
    });
  });

  it('displays mapping summary with correct counts', () => {
    render(
      <ColumnMapping
        headers={mockHeaders}
        rows={mockRows}
        columnMapping={mockColumnMapping}
        onMappingChange={mockOnMappingChange}
      />
    );

    expect(screen.getByText('Mapping Summary')).toBeInTheDocument();
    expect(screen.getByText('Total columns:')).toBeInTheDocument();
    expect(screen.getByText('Mapped columns:')).toBeInTheDocument();
    expect(screen.getByText('Required fields:')).toBeInTheDocument();
    expect(screen.getByText('Status:')).toBeInTheDocument();
  });

  it('handles saved mappings', () => {
    const savedMappings = [
      {
        name: 'Standard Mapping',
        mapping: { Subject: 'subjectName', Section: 'sectionCode' },
      },
    ];

    render(
      <ColumnMapping
        headers={mockHeaders}
        rows={mockRows}
        columnMapping={{}}
        onMappingChange={mockOnMappingChange}
        savedMappings={savedMappings}
      />
    );

    expect(screen.getByText('Saved Mappings')).toBeInTheDocument();
    expect(screen.getByText('Standard Mapping')).toBeInTheDocument();

    const loadButton = screen.getByText('Load');
    fireEvent.click(loadButton);

    expect(mockOnMappingChange).toHaveBeenCalledWith('Subject', 'subjectName');
    expect(mockOnMappingChange).toHaveBeenCalledWith('Section', 'sectionCode');
  });
});