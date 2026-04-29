import React from 'react';
import { Box, Container, Link, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const TermsOfService = () => (
  <Container maxWidth="md" sx={{ py: 4 }}>
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Terms of Service
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Last updated placeholder — replace this page with terms reviewed by qualified counsel before
        production use.
      </Typography>
      <Typography variant="body1" paragraph>
        These Terms of Service govern your use of Flight Match Finder. By creating an account or using
        the service, you agree to these terms and to our{' '}
        <Link component={RouterLink} to="/privacy">
          Privacy Policy
        </Link>
        .
      </Typography>
      <Typography variant="body1" paragraph>
        The service is provided &quot;as is&quot; without warranties of any kind. We may modify or
        discontinue features with reasonable notice where practicable.
      </Typography>
      <Box sx={{ mt: 3 }}>
        <Link component={RouterLink} to="/auth">
          Back to sign in
        </Link>
      </Box>
    </Paper>
  </Container>
);

export default TermsOfService;
