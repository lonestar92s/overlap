import React, { useState } from 'react';
import { Avatar, Box } from '@mui/material';

const TeamLogo = ({ 
    src, 
    alt, 
    teamName, 
    size = 40, 
    sx = {},
    style = {},
    className = ''
}) => {
    const [logoSrc, setLogoSrc] = useState(src);
    const [hasError, setHasError] = useState(false);
    const [fallbackAttempts, setFallbackAttempts] = useState(0);

    const handleError = () => {
        if (fallbackAttempts === 0) {
            // Try footapi.com as first fallback
            const teamId = logoSrc?.match(/\/(\d+)\.png$/);
            if (teamId) {
                setLogoSrc(`https://logos.footapi.com/teams/${teamId[1]}.png`);
                setFallbackAttempts(1);
                return;
            }
        }
        
        if (fallbackAttempts === 1) {
            // Try clearbit as second fallback
            const cleanTeamName = teamName?.toLowerCase()
                .replace(/\s+/g, '')
                .replace(/fc|cf|united|city|town|rovers|athletic|football|club/g, '');
            
            if (cleanTeamName) {
                setLogoSrc(`https://logo.clearbit.com/${cleanTeamName}.com`);
                setFallbackAttempts(2);
                return;
            }
        }
        
        // Final fallback - show placeholder
        setHasError(true);
    };

    // Create team initials for placeholder
    const getTeamInitials = (name) => {
        if (!name) return '?';
        return name.split(' ')
            .map(word => word[0])
            .join('')
            .substring(0, 2)
            .toUpperCase();
    };

    const initials = getTeamInitials(teamName);

    // If all fallbacks failed, show placeholder
    if (hasError) {
        return (
            <Box
                sx={{
                    width: size,
                    height: size,
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 'bold',
                    fontSize: size * 0.4,
                    borderRadius: '50%',
                    minWidth: size,
                    minHeight: size,
                    ...sx
                }}
                style={style}
                className={className}
            >
                {initials}
            </Box>
        );
    }

    // Show logo with error handling
    return (
        <Avatar
            src={logoSrc}
            alt={alt}
            sx={{
                width: size,
                height: size,
                ...sx
            }}
            style={style}
            className={className}
            onError={handleError}
        />
    );
};

export default TeamLogo; 