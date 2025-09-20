import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import DataPreview from '../DataPreview';

describe('DataPreview', () => {
  const mockHeaders = ['Subject', 'Section', 'Time', 'Room'];
  const mockRows = [
    { Subject: 'Math 101', Section: '001', Time: '09:00', Room: 'A101' },
    { Subject: 'Physics 201', Section: '002', Time: '14:00', Room: 'B202' },
    { Subject: 'Chemistry 301', Section: '003', Time: 'invalid', Room: '' },
  ];
  const mockColumnMapping = {
    Subject: 'subjectName',
    Section: 'sectionCode',
    Time: 'startTime',
    Room: 'room',
  };
  const mockValidationErrors = [
    {
      row: 3,
      column: 'Time',
      message: 'Invalid time format',
      value: 'invalid',
    },
    {
      row: 3,
      column: 'Room',
      message: 'Room is required',
      value: '',
    },
  ];

  it('renders data preview table', () => {
    render(
      <DataPreview
        headers={mockHeaders}
        rows={mockRows}
        totalRows={mockRows.length}
      />
    );

    expect(screen.getByText('Data Preview')).toBeInTheDocument();
    expect(screen.getByText('Row #')).toBeInTheDocument();
    
    // Check headers
    mockHeaders.forEach(header => {
      expect(screen.getByText(header)).toBeInTheDocument();
    });
  });

  it('displays row data correctly', () => {
    render(
      <DataPreview
        headers={mockHeaders}
        rows={mockRows}
        totalRows={mockRows.length}
      />
    );

    expect(screen.getByText('Math 101')).toBeInTheDocument();
    expect(screen.getByText('001')).toBeInTheDocument();
    expect(screen.getByText('09:00')).toBeInTheDocument();
    expect(screen.getByText('A101')).toBeInTheDocument();
  });

  it('shows column mapping information', () => {
    render(
      <DataPreview
        headers={mockHeaders}
        rows={mockRows}
        totalRows={mockRows.length}
        columnMapping={mockColumnMapping}
      />
    );

    expect(screen.getByText('→ Subject Name')).toBeInTheDocument();
    expect(screen.getByText('→ Section Code')).toBeInTheDocument();
    expect(screen.getByText('→ Start Time')).toBeInTheDocument();
    expect(screen.getByText('→ Room')).toBeInTheDocument();
  });

  it('displays validation errors', () => {
    render(
      <DataPreview
        headers={mockHeaders}
        rows={mockRows}
        totalRows={mockRows.length}
        validationErrors={mockValidationErrors}
      />
    );

    expect(screen.getByText(/2 validation errors found/)).toBeInTheDocument();
    expect(screen.getByText('Invalid time format')).toBeInTheDocument();
    expect(screen.getByText('Room is required')).toBeInTheDocument();
  });

  it('handles error-only filter', () => {
    render(
      <DataPreview
        headers={mockHeaders}
        rows={mockRows}
        totalRows={mockRows.length}
        validationErrors={mockValidationErrors}
      />
    );

    const errorCheckbox = screen.getByLabelText(/Show errors only/);
    fireEvent.click(errorCheckbox);

    // Should only show rows with errors
    expect(screen.getByText('Chemistry 301')).toBeInTheDocument();
    expect(screen.queryByText('Math 101')).not.toBeInTheDocument();
  });

  it('handles empty cells correctly', () => {
    const rowsWithEmpty = [
      { Subject: 'Math 101', Section: '', Time: null, Room: undefined },
    ];

    render(
      <DataPreview
        headers={mockHeaders}
        rows={rowsWithEmpty}
        totalRows={1}
      />
    );

    // Should show "empty" for null/undefined/empty values
    const emptyCells = screen.getAllByText('empty');
    expect(emptyCells.length).toBeGreaterThan(0);
  });

  it('truncates long cell values', () => {
    const longValue = 'A'.repeat(60);
    const rowsWithLongValue = [
      { Subject: longValue, Section: '001', Time: '09:00', Room: 'A101' },
    ];

    render(
      <DataPreview
        headers={mockHeaders}
        rows={rowsWithLongValue}
        totalRows={1}
      />
    );

    // Should truncate and show ellipsis
    expect(screen.getByText(/A{47}\.\.\.$/)).toBeInTheDocument();
  });

  it('handles pagination', () => {
    const manyRows = Array.from({ length: 25 }, (_, i) => ({
      Subject: `Subject ${i}`,
      Section: `00${i}`,
      Time: '09:00',
      Room: `Room ${i}`,
    }));

    render(
      <DataPreview
        headers={mockHeaders}
        rows={manyRows}
        totalRows={25}
        maxPreviewRows={10}
      />
    );

    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();

    // Click next page
    const nextButton = screen.getByText('Next');
    fireEvent.click(nextButton);

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
  });

  it('shows correct row count information', () => {
    render(
      <DataPreview
        headers={mockHeaders}
        rows={mockRows.slice(0, 2)} // Show only 2 rows
        totalRows={100} // But total file has 100 rows
      />
    );

    expect(screen.getByText('Showing 2 of 2 rows')).toBeInTheDocument();
    expect(screen.getByText('(total: 100 rows in file)')).toBeInTheDocument();
  });

  it('shows empty state when no data', () => {
    render(
      <DataPreview
        headers={mockHeaders}
        rows={[]}
        totalRows={0}
      />
    );

    expect(screen.getByText('No data to preview')).toBeInTheDocument();
  });

  it('shows skipped columns correctly', () => {
    const mappingWithSkipped = {
      Subject: 'subjectName',
      Section: '', // Skipped
      Time: 'startTime',
      Room: 'room',
    };

    render(
      <DataPreview
        headers={mockHeaders}
        rows={mockRows}
        totalRows={mockRows.length}
        columnMapping={mappingWithSkipped}
      />
    );

    expect(screen.getByText('(skipped)')).toBeInTheDocument();
  });
});