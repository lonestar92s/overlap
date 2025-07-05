import React, { useState } from 'react';
import { format } from 'date-fns';
import './MatchCarousel.css';

const Heart = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 24, height: 24 }}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const HeartFilled = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 24, height: 24 }}>
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
  </svg>
);

const MatchCard = ({ match }) => {
  const [isFavorite, setIsFavorite] = useState(false);

  const toggleFavorite = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsFavorite(!isFavorite);
  };

  return (
    <div className="match-card">
      <div className="match-card-image">
        <div className="favorite-button" onClick={toggleFavorite}>
          {isFavorite ? <HeartFilled /> : <Heart />}
        </div>
      </div>
      
      <div className="match-card-content">
        <div className="match-teams">
          {match.homeTeam.name} vs {match.awayTeam.name}
        </div>
        <div className="match-date">
          {format(new Date(match.kickoff), 'EEE, MMM d • h:mm a')}
        </div>
        <div className="match-location">
          {match.stadium.name} • {match.stadium.city}
        </div>
        <div className="match-competition">
          {match.competition.name}
        </div>
      </div>
    </div>
  );
};

export const MatchCarousel = ({ title, matches }) => {
  return (
    <section className="match-carousel">
      <div className="carousel-header">
        <h2>{title}</h2>
        <button className="see-all">See all</button>
      </div>
      
      <div className="carousel-container">
        {matches.map(match => (
          <MatchCard key={match.id} match={match} />
        ))}
      </div>
    </section>
  );
};
