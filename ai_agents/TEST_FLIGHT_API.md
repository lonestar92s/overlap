# Testing Flight API Integration

## Quick Test Commands

### 1. Test Flight Search Endpoint

Replace `YOUR_RAILWAY_URL` with your actual Railway URL (e.g., `https://friendly-gratitude-production-3f31.up.railway.app`)

```bash
# Test flight search (JFK to LHR, example date)
curl "https://friendly-gratitude-production-3f31.up.railway.app/api/transportation/flights/search?origin=JFK&destination=LHR&departureDate=2024-12-01&adults=1&max=5"
```

### 2. Test Airport Search

```bash
# Search for airports by keyword
curl "https://friendly-gratitude-production-3f31.up.railway.app/api/transportation/airports/search?query=london&limit=5"
```

### 3. Test Nearest Airports

```bash
# Get nearest airports to coordinates (London example)
curl "https://friendly-gratitude-production-3f31.up.railway.app/api/transportation/airports/nearest?latitude=51.5074&longitude=-0.1278&radius=50&limit=3"
```

## Expected Responses

### Successful Flight Search Response

```json
{
  "success": true,
  "provider": "AmadeusProvider",
  "data": [
    {
      "id": "1",
      "price": {
        "currency": "USD",
        "amount": 450.50,
        "formatted": "USD 450.50"
      },
      "origin": {
        "code": "JFK",
        "name": "JFK",
        "city": "JFK"
      },
      "destination": {
        "code": "LHR",
        "name": "LHR",
        "city": "LHR"
      },
      "departure": {
        "date": "2024-12-01T10:30:00",
        "time": "10:30",
        "airport": "JFK"
      },
      "arrival": {
        "date": "2024-12-01T22:15:00",
        "time": "22:15",
        "airport": "LHR"
      },
      "duration": 705,
      "stops": 0,
      "airline": {
        "name": "BA",
        "code": "BA"
      },
      "segments": [...],
      "bookingUrl": null,
      "provider": "amadeus"
    }
  ],
  "count": 1
}
```

### Error Response (if credentials missing)

```json
{
  "error": "Failed to search flights",
  "message": "Amadeus credentials not configured. Set AMADEUS_CLIENT_ID and AMADEUS_CLIENT_SECRET"
}
```

## Common Issues & Solutions

### Issue: "Amadeus credentials not configured"
**Solution**: 
- Check Railway variables are set correctly
- Variable names must be exactly: `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`, `AMADEUS_ENVIRONMENT`
- Redeploy after adding variables

### Issue: "All flight providers failed"
**Solution**:
- Check Railway logs for detailed error
- Verify API key/secret are correct
- Ensure `AMADEUS_ENVIRONMENT=test` for test credentials
- Test credentials should start with `test_`

### Issue: Empty results `{"data": []}`
**Solution**:
- This is normal if no flights found for that route/date
- Try different dates or routes
- Check Amadeus test data availability

## Check Railway Logs

1. Go to Railway dashboard
2. Select your service
3. Click "Deployments" → Latest deployment → "View Logs"
4. Look for:
   - ✅ "Amadeus provider initialized" (success)
   - ❌ "Amadeus credentials not configured" (error)
   - ❌ "Amadeus API error" (API issue)

## Next Steps

Once testing is successful:
1. ✅ Flight search working
2. ✅ Airport search working
3. ✅ Route cost history tracking (automatic)
4. 🚀 Ready for mobile app integration!

