import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Trips from './Trips';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate
}));

jest.mock('../hooks/useVisitedStadiums', () => ({
  __esModule: true,
  default: () => ({
    visitedStadiums: [],
    loading: false,
    removeVisitedStadium: jest.fn()
  })
}));

jest.mock('./RecommendedMatches', () => () => null);
jest.mock('./TripModal', () => () => null);
jest.mock('./TeamLogo', () => () => null);

describe('Trips', () => {
  let deleteRequestOk = true;

  beforeEach(() => {
    jest.clearAllMocks();
    deleteRequestOk = true;
    Storage.prototype.getItem = jest.fn(() => 'fake-token');

    global.fetch = jest.fn((url, options = {}) => {
      const method = options.method || 'GET';

      if (url === 'http://localhost:3001/api/trips' && method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              trips: [
                {
                  _id: 'trip-1',
                  name: 'Weekend Away',
                  description: 'Sample trip',
                  matches: [],
                  createdAt: '2026-04-20T12:00:00.000Z'
                }
              ]
            })
        });
      }

      if (url === 'http://localhost:3001/api/preferences/saved-matches' && method === 'GET') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ savedMatches: [] })
        });
      }

      if (url === 'http://localhost:3001/api/trips/trip-1' && method === 'DELETE') {
        return Promise.resolve({ ok: deleteRequestOk });
      }

      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
  });

  it('navigates to trips route after deleting a trip', async () => {
    render(
      <MemoryRouter>
        <Trips />
      </MemoryRouter>
    );

    expect(await screen.findByText('Weekend Away')).toBeTruthy();

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/trips');
    });
  });

  it('does not navigate when deleting a trip fails', async () => {
    deleteRequestOk = false;

    render(
      <MemoryRouter>
        <Trips />
      </MemoryRouter>
    );

    expect(await screen.findByText('Weekend Away')).toBeTruthy();

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/trips/trip-1', {
        method: 'DELETE',
        headers: {
          Authorization: 'Bearer fake-token'
        }
      });
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
