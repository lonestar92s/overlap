import React from 'react';
import { Box, Container, Link, Paper, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';

const PrivacyPolicy = () => (
  <Container maxWidth="md" sx={{ py: 4 }}>
    <Paper elevation={0} sx={{ p: { xs: 2, sm: 4 } }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Privacy Policy
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Last updated placeholder — replace this page with a policy reviewed by qualified counsel before
        production use.
      </Typography>
      <Typography variant="body1" paragraph>
        This policy describes how Flight Match Finder collects, uses, and shares information when you use
        our websites and applications. It should accurately reflect your data practices, third-party
        services (analytics, hosting, email), and regional requirements that apply to your users.
      </Typography>
      <Typography variant="body1" paragraph>
        For questions about privacy, contact the address you publish for your product.
      </Typography>
      <Typography variant="body1" paragraph>
        <strong>Your choices:</strong> California residents and other users may have the right to request
        deletion of personal information. When you delete your account in the app or on the web (Profile),
        we remove your user record and scrub identifiers linked to you where applicable. Replace this section
        with jurisdiction-specific language your counsel approves.
      </Typography>
      <Box sx={{ mt: 3 }}>
        <Link component={RouterLink} to="/terms">
          Terms of Service
        </Link>
        {' · '}
        <Link component={RouterLink} to="/auth">
          Back to sign in
        </Link>
      </Box>
    </Paper>
  </Container>
);

export default PrivacyPolicy;
