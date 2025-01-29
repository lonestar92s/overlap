import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    FormControlLabel,
    RadioGroup,
    Radio,
    Typography,
    Box,
    IconButton
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const DISTANCE_OPTIONS = [
    { value: 50, label: '50 miles' },
    { value: 100, label: '100 miles' },
    { value: 250, label: '250 miles' }
];

const Filters = ({ open, onClose, selectedDistance, onDistanceChange }) => {
    const handleDistanceChange = (event) => {
        console.log('Radio changed:', event.target.value);
        const value = event.target.value === 'all' ? null : Number(event.target.value);
        onDistanceChange(value);
    };

    return (
        <Dialog 
            open={open} 
            onClose={onClose}
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    width: '100%',
                    maxWidth: '400px'
                }
            }}
        >
            <DialogTitle sx={{ 
                m: 0, 
                p: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
                    Filter Matches
                </Typography>
                <IconButton
                    aria-label="close"
                    onClick={onClose}
                    sx={{
                        color: (theme) => theme.palette.grey[500]
                    }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Box sx={{ py: 1 }}>
                    <Typography 
                        variant="subtitle1" 
                        sx={{ 
                            mb: 2,
                            fontWeight: 500,
                            color: '#444'
                        }}
                    >
                        Distance from your location
                    </Typography>
                    <FormControl component="fieldset">
                        <RadioGroup
                            value={selectedDistance === null ? 'all' : selectedDistance.toString()}
                            onChange={handleDistanceChange}
                        >
                            <FormControlLabel 
                                value="all" 
                                control={<Radio />} 
                                label="Show all matches"
                                sx={{ mb: 1 }}
                            />
                            {DISTANCE_OPTIONS.map((option) => (
                                <FormControlLabel
                                    key={option.value}
                                    value={option.value.toString()}
                                    control={<Radio />}
                                    label={option.label}
                                    sx={{ mb: 1 }}
                                />
                            ))}
                        </RadioGroup>
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions sx={{ p: 2 }}>
                <Button 
                    onClick={onClose}
                    variant="contained"
                    sx={{
                        backgroundColor: '#FF385C',
                        '&:hover': {
                            backgroundColor: '#E61E4D'
                        }
                    }}
                >
                    Done
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default Filters; 