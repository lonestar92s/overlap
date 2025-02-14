import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Stepper,
    Step,
    StepLabel,
    StepContent,
    Button,
    CircularProgress,
    IconButton,
    Collapse,
} from '@mui/material';
import {
    DirectionsCar,
    Train,
    Flight,
    ExpandMore,
    ExpandLess,
    Schedule,
} from '@mui/icons-material';
import { format } from 'date-fns';
import { getVenueForTeam } from '../data/venues';
import { getTransportationOptions } from '../services/transportationService';

const TransportOption = ({ 
    option, 
    isSelected, 
    onSelect, 
    loading 
}) => {
    const [expanded, setExpanded] = useState(false);

    const getIcon = () => {
        switch (option.type) {
            case 'driving':
                return <DirectionsCar />;
            case 'transit':
                return <Train />;
            case 'flight':
                return <Flight />;
            default:
                return null;
        }
    };

    return (
        <Paper
            elevation={isSelected ? 2 : 0}
            sx={{
                p: 2,
                mb: 1,
                border: '1px solid',
                borderColor: isSelected ? 'primary.main' : 'grey.300',
                cursor: 'pointer',
                '&:hover': {
                    borderColor: 'primary.main',
                }
            }}
            onClick={() => !loading && onSelect(option)}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {getIcon()}
                    <Box>
                        <Typography variant="subtitle1">
                            {option.type.charAt(0).toUpperCase() + option.type.slice(1)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {option.duration} • {option.distance && `${option.distance} • `}{option.price}
                        </Typography>
                    </Box>
                </Box>
                {!loading && (
                    <IconButton 
                        size="small"
                        onClick={(e) => {
                            e.stopPropagation();
                            setExpanded(!expanded);
                        }}
                    >
                        {expanded ? <ExpandLess /> : <ExpandMore />}
                    </IconButton>
                )}
            </Box>
            
            <Collapse in={expanded}>
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" dangerouslySetInnerHTML={{ __html: option.details }} />
                </Box>
            </Collapse>
        </Paper>
    );
};

const ItineraryBuilder = ({ 
    selectedMatches, 
    onTransportationSelect,
    selectedTransportation = {},
    onSave
}) => {
    const [transportationOptions, setTransportationOptions] = useState({});
    const [loading, setLoading] = useState({});

    // Fetch transportation options when matches change
    useEffect(() => {
        const fetchTransportationOptions = async () => {
            // Generate options for each pair of consecutive matches
            for (let i = 0; i < selectedMatches.length - 1; i++) {
                const currentMatch = selectedMatches[i];
                const nextMatch = selectedMatches[i + 1];
                
                const currentVenue = getVenueForTeam(currentMatch.homeTeam.name);
                const nextVenue = getVenueForTeam(nextMatch.homeTeam.name);
                
                if (!currentVenue?.coordinates || !nextVenue?.coordinates) continue;

                const transportKey = `${currentMatch.id}-${nextMatch.id}`;
                setLoading(prev => ({ ...prev, [transportKey]: true }));

                try {
                    const options = await getTransportationOptions(
                        currentVenue.coordinates,
                        nextVenue.coordinates,
                        format(new Date(nextMatch.utcDate), 'yyyy-MM-dd')
                    );

                    setTransportationOptions(prev => ({
                        ...prev,
                        [transportKey]: options
                    }));
                } catch (error) {
                    console.error('Error fetching transportation options:', error);
                } finally {
                    setLoading(prev => ({ ...prev, [transportKey]: false }));
                }
            }
        };

        if (selectedMatches.length > 1) {
            fetchTransportationOptions();
        }
    }, [selectedMatches]);

    if (selectedMatches.length === 0) {
        return (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="subtitle1" color="text.secondary">
                    Select matches to build your itinerary
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
                <Typography variant="h6">
                    Your Itinerary
                </Typography>
                {selectedMatches.length > 0 && (
                    <Button
                        variant="contained"
                        onClick={onSave}
                        disabled={
                            selectedMatches.length < 2 ||
                            Object.keys(selectedTransportation).length < selectedMatches.length - 1
                        }
                    >
                        Save Itinerary
                    </Button>
                )}
            </Box>

            <Stepper orientation="vertical">
                {selectedMatches.map((match, index) => {
                    const venue = getVenueForTeam(match.homeTeam.name);
                    const matchDate = new Date(match.utcDate);
                    const nextMatch = selectedMatches[index + 1];
                    const transportKey = nextMatch ? `${match.id}-${nextMatch.id}` : null;
                    const options = transportKey ? transportationOptions[transportKey] : null;
                    const isLoading = transportKey ? loading[transportKey] : false;

                    return (
                        <Step key={match.id} active={true}>
                            <StepLabel
                                StepIconComponent={() => (
                                    <Schedule color="primary" />
                                )}
                            >
                                <Typography variant="subtitle1">
                                    {format(matchDate, 'EEE, MMM d • h:mm a')}
                                </Typography>
                            </StepLabel>
                            <StepContent>
                                <Box sx={{ mb: 2 }}>
                                    <Typography variant="body1" sx={{ mb: 1 }}>
                                        {match.homeTeam.name} vs {match.awayTeam.name}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {venue?.stadium}, {venue?.location}
                                    </Typography>
                                </Box>

                                {transportKey && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 1 }}>
                                            Transportation to next match:
                                        </Typography>
                                        {isLoading ? (
                                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                                <CircularProgress size={24} />
                                            </Box>
                                        ) : options && options.length > 0 ? (
                                            options.map((option, optionIndex) => (
                                                <TransportOption
                                                    key={optionIndex}
                                                    option={option}
                                                    isSelected={
                                                        selectedTransportation[transportKey]?.type === option.type
                                                    }
                                                    onSelect={(selected) => {
                                                        onTransportationSelect(transportKey, selected);
                                                    }}
                                                    loading={isLoading}
                                                />
                                            ))
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">
                                                No transportation options available
                                            </Typography>
                                        )}
                                    </Box>
                                )}
                            </StepContent>
                        </Step>
                    );
                })}
            </Stepper>
        </Paper>
    );
};

export default ItineraryBuilder; 