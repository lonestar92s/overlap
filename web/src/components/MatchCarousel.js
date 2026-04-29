import React, { useState } from 'react';
import { format } from 'date-fns';
import { Heart, HeartFilled } from './Icons';
import './MatchCarousel.css';

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

const MatchCarousel = ({ title, matches }) => {
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

export default MatchCarousel; 