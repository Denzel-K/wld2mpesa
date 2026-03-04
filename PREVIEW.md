# Preview & Local Development on Linux

The official and recommended way to preview WLD2Mpesa on Linux is using the **Worldcoin MiniKit Simulator**. This is a browser-based tool provided by the Worldcoin Developer Portal that mirrors the World App environment.

## Using the MiniKit Simulator

Follow these steps to test your app in a realistic environment:

1. **Start your local services**:
   ```bash
   # Terminal 1 — Backend
   cd backend && npm run dev
   # Terminal 2 — Frontend
   cd frontend && npm run dev
   ```

2. **Access the Developer Portal**:
   - Go to [developer.worldcoin.org](https://developer.worldcoin.org/).
   - Log in and select your App (or create a new one).

3. **Open the Simulator**:
   - Navigate to **MiniKit > Simulator** in the sidebar.
   - In the "Address Bar" within the simulator, enter your local frontend URL: `http://localhost:3000`.

4. **Interact with the App**:
   - The simulator will render your app within a "World App" frame.
   - It correctly handles MiniKit commands like `pay` and `verify`, allowing you to test the full flow without needing the physical app.

## Troubleshooting

- **CORS Errors**: If you see "Cross-Origin Request Blocked" in your browser console, ensure the backend is running and that your `CORS_ORIGIN` settings in `backend/src/server.ts` allow `https://developer.worldcoin.org`.
- **Wallet Not Found**: Ensure you are using the simulator. Regular browser tabs (outside the simulator) will show the "Open in World App" blocker because they lack the MiniKit environment.

## Deployment Notes

Simulation mode is only intended for local development. In production, the `isInsideWorldApp()` check will correctly identify whether the user is in the real World App.
