import React, { useState, useEffect, useRef } from 'react';
import TeamLogo from './TeamLogo';
import './TeamSearch.css';

const BACKEND_URL = 'http://localhost:3001';

const TeamSearch = ({ onTeamSelect, placeholder = "Search for teams...", selectedTeams = [] }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showDropdown, setShowDropdown] = useState(false);
    const [popularTeams, setPopularTeams] = useState([]);
    const searchRef = useRef(null);
    const dropdownRef = useRef(null);

    // Load popular teams on component mount
    useEffect(() => {
        loadPopularTeams();
    }, []);

    // Handle search with debouncing
    useEffect(() => {
        if (searchTerm.length >= 2) {
            const timeoutId = setTimeout(() => {
                searchTeams(searchTerm);
            }, 300);
            return () => clearTimeout(timeoutId);
        } else {
            setSearchResults([]);
        }
    }, [searchTerm]);

    // Handle clicks outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadPopularTeams = async () => {
        try {
            const response = await fetch(`${BACKEND_URL}/api/teams/popular?limit=20`);
            const data = await response.json();
            if (data.success) {
                setPopularTeams(data.teams);
            }
        } catch (error) {
            console.error('Error loading popular teams:', error);
        }
    };

    const searchTeams = async (term) => {
        setIsLoading(true);
        try {
            const response = await fetch(`${BACKEND_URL}/api/teams/search?query=${encodeURIComponent(term)}&limit=15`);
            const data = await response.json();
            if (data.success) {
                setSearchResults(data.results);
                setShowDropdown(true);
            }
        } catch (error) {
            console.error('Error searching teams:', error);
            setSearchResults([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleInputChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);
        if (value.length === 0) {
            setShowDropdown(false);
        }
    };

    const handleInputFocus = () => {
        if (searchTerm.length >= 2) {
            setShowDropdown(true);
        } else if (popularTeams.length > 0) {
            setShowDropdown(true);
        }
    };

    const handleTeamSelect = (team) => {
        onTeamSelect(team);
        setSearchTerm('');
        setShowDropdown(false);
        setSearchResults([]);
    };

    const isTeamSelected = (teamId) => {
        return selectedTeams.some(team => team.id === teamId || team.teamId?.id === teamId);
    };

    const getDisplayTeams = () => {
        if (searchTerm.length >= 2 && searchResults.length > 0) {
            return searchResults;
        }
        if (searchTerm.length < 2 && popularTeams.length > 0) {
            return popularTeams.slice(0, 10);
        }
        return [];
    };

    // Helper function for team display formatting (if needed in future)
    // const formatTeamDisplay = (team) => {
    //     let display = team.name;
    //     if (team.country && team.country !== 'Unknown') {
    //         display += ` (${team.country})`;
    //     }
    //     if (team.code) {
    //         display += ` - ${team.code}`;
    //     }
    //     return display;
    // };

    return (
        <div className="team-search" ref={dropdownRef}>
            <div className="search-input-container">
                <input
                    ref={searchRef}
                    type="text"
                    value={searchTerm}
                    onChange={handleInputChange}
                    onFocus={handleInputFocus}
                    placeholder={placeholder}
                    className="team-search-input"
                />
                {isLoading && (
                    <div className="search-loading">
                        <span className="loading-spinner">⚽</span>
                    </div>
                )}
            </div>

            {showDropdown && (
                <div className="search-dropdown">
                    {searchTerm.length < 2 && popularTeams.length > 0 && (
                        <div className="dropdown-section">
                            <div className="dropdown-header">Popular Teams</div>
                        </div>
                    )}
                    
                    {searchTerm.length >= 2 && searchResults.length === 0 && !isLoading && (
                        <div className="no-results">
                            No teams found for "{searchTerm}"
                        </div>
                    )}

                    <div className="dropdown-results">
                        {getDisplayTeams().map((team) => (
                            <div
                                key={team.id}
                                className={`dropdown-item ${isTeamSelected(team.id) ? 'selected' : ''}`}
                                onClick={() => handleTeamSelect(team)}
                            >
                                <div className="team-info">
                                    <TeamLogo 
                                        src={team.logo} 
                                        alt={`${team.name} logo`}
                                        teamName={team.name}
                                        size={32}
                                        className="team-logo"
                                    />
                                    <div className="team-details">
                                        <div className="team-name">{team.name}</div>
                                        <div className="team-meta">
                                            {team.country && team.country !== 'Unknown' && (
                                                <span className="team-country">{team.country}</span>
                                            )}
                                            {team.code && (
                                                <span className="team-code">{team.code}</span>
                                            )}
                                            {team.venue && (
                                                <span className="team-venue">{team.venue}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {isTeamSelected(team.id) && (
                                    <div className="selected-indicator">✓</div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default TeamSearch; 