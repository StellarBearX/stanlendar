import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { VirtualScrollList, useVirtualScroll, EventListItem } from '../VirtualScrollList';

// Mock data
const mockEvents = Array.from({ length: 1000 }, (_, i) => ({
  id: `event-${i}`,
  title: `Event ${i}`,
  startTime: '09:00',
  endTime: '10:00',
  room: `Room ${i % 10}`,
  subject: {
    name: `Subject ${i % 5}`,
    colorHex: '#FF0000'
  }
}));

describe('VirtualScrollList', () => {
  const defaultProps = {
    items: mockEvents.slice(0, 100),
    itemHeight: 80,
    containerHeight: 400,
    renderItem: (item: any, index: number) => (
      <EventListItem key={item.id} event={item} index={index} />
    )
  };

  it('should render visible items only', () => {
    render(<VirtualScrollList {...defaultProps} />);
    
    // Should render approximately 5-6 visible items (400px / 80px = 5)
    // Plus overscan items (default 5 on each side)
    const visibleItems = screen.getAllByText(/Event \d+/);
    expect(visibleItems.length).toBeLessThan(20); // Much less than total 100 items
    expect(visibleItems.length).toBeGreaterThan(5);
  });

  it('should update visible items on scroll', async () => {
    const { container } = render(<VirtualScrollList {...defaultProps} />);
    const scrollContainer = container.firstChild as HTMLElement;
    
    // Initial state - should show items starting from 0
    expect(screen.getByText('Event 0')).toBeInTheDocument();
    
    // Scroll down
    fireEvent.scroll(scrollContainer, { target: { scrollTop: 800 } });
    
    await waitFor(() => {
      // Should now show items around index 10 (800px / 80px = 10)
      expect(screen.queryByText('Event 0')).not.toBeInTheDocument();
      expect(screen.getByText(/Event 1[0-9]/)).toBeInTheDocument();
    });
  });

  it('should handle empty items array', () => {
    render(<VirtualScrollList {...defaultProps} items={[]} />);
    
    const visibleItems = screen.queryAllByText(/Event \d+/);
    expect(visibleItems).toHaveLength(0);
  });

  it('should call onScroll callback', () => {
    const onScrollMock = jest.fn();
    const { container } = render(
      <VirtualScrollList {...defaultProps} onScroll={onScrollMock} />
    );
    
    const scrollContainer = container.firstChild as HTMLElement;
    fireEvent.scroll(scrollContainer, { target: { scrollTop: 200 } });
    
    expect(onScrollMock).toHaveBeenCalledWith(200);
  });

  it('should handle infinite scroll', async () => {
    const loadMoreMock = jest.fn();
    const { container } = render(
      <VirtualScrollList 
        {...defaultProps} 
        loadMore={loadMoreMock}
        hasMore={true}
      />
    );
    
    const scrollContainer = container.firstChild as HTMLElement;
    
    // Mock scroll to near bottom
    Object.defineProperty(scrollContainer, 'scrollHeight', { value: 8000 });
    Object.defineProperty(scrollContainer, 'clientHeight', { value: 400 });
    
    fireEvent.scroll(scrollContainer, { target: { scrollTop: 7500 } });
    
    await waitFor(() => {
      expect(loadMoreMock).toHaveBeenCalled();
    });
  });

  it('should show loading indicator when loading', () => {
    render(
      <VirtualScrollList 
        {...defaultProps} 
        loading={true}
        hasMore={true}
      />
    );
    
    expect(screen.getByText('Loading more...')).toBeInTheDocument();
  });

  it('should handle custom overscan', () => {
    render(<VirtualScrollList {...defaultProps} overscan={10} />);
    
    // With higher overscan, should render more items
    const visibleItems = screen.getAllByText(/Event \d+/);
    expect(visibleItems.length).toBeGreaterThan(15); // More than default overscan
  });
});

describe('useVirtualScroll', () => {
  function TestComponent() {
    const {
      scrollTop,
      setScrollTop,
      visibleRange,
      scrollToIndex,
      scrollToTop,
      totalHeight
    } = useVirtualScroll(mockEvents.slice(0, 50), 80, 400);

    return (
      <div>
        <div data-testid="scroll-top">{scrollTop}</div>
        <div data-testid="visible-start">{visibleRange.start}</div>
        <div data-testid="visible-end">{visibleRange.end}</div>
        <div data-testid="total-height">{totalHeight}</div>
        <button onClick={() => scrollToIndex(10)}>Scroll to 10</button>
        <button onClick={scrollToTop}>Scroll to top</button>
        <button onClick={() => setScrollTop(800)}>Set scroll</button>
      </div>
    );
  }

  it('should calculate visible range correctly', () => {
    render(<TestComponent />);
    
    expect(screen.getByTestId('visible-start')).toHaveTextContent('0');
    expect(screen.getByTestId('visible-end')).toHaveTextContent('4'); // 400/80 = 5 items (0-4)
    expect(screen.getByTestId('total-height')).toHaveTextContent('4000'); // 50 * 80
  });

  it('should update visible range when scrollTop changes', () => {
    render(<TestComponent />);
    
    fireEvent.click(screen.getByText('Set scroll'));
    
    expect(screen.getByTestId('scroll-top')).toHaveTextContent('800');
    expect(screen.getByTestId('visible-start')).toHaveTextContent('10'); // 800/80 = 10
  });

  it('should scroll to specific index', () => {
    render(<TestComponent />);
    
    fireEvent.click(screen.getByText('Scroll to 10'));
    
    expect(screen.getByTestId('scroll-top')).toHaveTextContent('800'); // 10 * 80
  });

  it('should scroll to top', () => {
    render(<TestComponent />);
    
    // First scroll down
    fireEvent.click(screen.getByText('Set scroll'));
    expect(screen.getByTestId('scroll-top')).toHaveTextContent('800');
    
    // Then scroll to top
    fireEvent.click(screen.getByText('Scroll to top'));
    expect(screen.getByTestId('scroll-top')).toHaveTextContent('0');
  });
});

describe('EventListItem', () => {
  const mockEvent = {
    id: 'event-1',
    title: 'Test Event',
    startTime: '09:00',
    endTime: '10:00',
    room: 'Room A',
    subject: {
      name: 'Mathematics',
      colorHex: '#FF0000'
    }
  };

  it('should render event information', () => {
    render(<EventListItem event={mockEvent} index={0} />);
    
    expect(screen.getByText('Test Event')).toBeInTheDocument();
    expect(screen.getByText('09:00 - 10:00 • Room A')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
  });

  it('should render without room', () => {
    const eventWithoutRoom = { ...mockEvent, room: undefined };
    render(<EventListItem event={eventWithoutRoom} index={0} />);
    
    expect(screen.getByText('09:00 - 10:00')).toBeInTheDocument();
    expect(screen.queryByText('Room A')).not.toBeInTheDocument();
  });

  it('should apply subject color', () => {
    const { container } = render(<EventListItem event={mockEvent} index={0} />);
    
    const colorIndicator = container.querySelector('[style*="background-color: rgb(255, 0, 0)"]');
    expect(colorIndicator).toBeInTheDocument();
  });

  it('should handle hover state', () => {
    const { container } = render(<EventListItem event={mockEvent} index={0} />);
    
    const listItem = container.firstChild as HTMLElement;
    expect(listItem).toHaveClass('hover:bg-gray-50');
  });
});

describe('Performance', () => {
  it('should not re-render unnecessarily', () => {
    let renderCount = 0;
    
    function TestItem({ item, index }: { item: any; index: number }) {
      renderCount++;
      return <div>{item.title}</div>;
    }
    
    const { rerender } = render(
      <VirtualScrollList
        items={mockEvents.slice(0, 10)}
        itemHeight={80}
        containerHeight={400}
        renderItem={(item, index) => <TestItem key={item.id} item={item} index={index} />}
      />
    );
    
    const initialRenderCount = renderCount;
    
    // Re-render with same props
    rerender(
      <VirtualScrollList
        items={mockEvents.slice(0, 10)}
        itemHeight={80}
        containerHeight={400}
        renderItem={(item, index) => <TestItem key={item.id} item={item} index={index} />}
      />
    );
    
    // Should not cause additional renders of visible items
    expect(renderCount).toBe(initialRenderCount);
  });

  it('should handle large datasets efficiently', () => {
    const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
      id: `item-${i}`,
      title: `Item ${i}`,
      startTime: '09:00',
      endTime: '10:00',
      subject: { name: 'Subject', colorHex: '#FF0000' }
    }));
    
    const start = performance.now();
    
    render(
      <VirtualScrollList
        items={largeDataset}
        itemHeight={80}
        containerHeight={400}
        renderItem={(item, index) => (
          <EventListItem key={item.id} event={item} index={index} />
        )}
      />
    );
    
    const renderTime = performance.now() - start;
    
    // Should render quickly even with large dataset
    expect(renderTime).toBeLessThan(100); // Less than 100ms
    
    // Should only render visible items
    const visibleItems = screen.getAllByText(/Item \d+/);
    expect(visibleItems.length).toBeLessThan(20); // Much less than 10000
  });
});