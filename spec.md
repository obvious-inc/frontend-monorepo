# Application Screen Implementation Plan

## Overview
Create a specialized application screen based on the existing topic screen, but with modifications to better suit the application workflow. The screen will display application details and provide a direct way to put applications to vote.

## Requirements
1. Start from the topic screen component as a base
2. Remove the participants section from the sidebar
3. Add a primary button at the top of the sidebar labeled "Put to vote" that triggers the add sponsorship signature flow
4. Ensure the screen properly displays application-specific content

## Implementation Plan

### 1. Create new Application Screen Component
- Create a new file: `src/components/application-screen.jsx`
- Base the component structure on `topic-screen.jsx`
- Implement a similar context provider pattern for state management
- Adapt the component to handle application-specific data and UI requirements

### 2. Main Component Structure
```jsx
export default function ApplicationScreen({ applicationId }) {
  // Context provider pattern similar to TopicScreen
  return (
    <ScreenContext.Provider value={/* context value */}>
      <MainComponent />
    </ScreenContext.Provider>
  );
}

function MainComponent() {
  // Main component implementation
  // Will include content area and sidebar with "Put to vote" button
}
```

### 3. Sidebar Modifications
- Add a prominent "Put to vote" primary button at the top of the sidebar
- Remove the participants section entirely
- Retain the last activity information
- Retain the status display (Active, Closed, or Stale)
- Consider adding application-specific metadata in the sidebar (e.g., funding requested, timeline, etc.)

```jsx
function Sidebar() {
  return (
    <aside>
      <div className="sidebar-top-action">
        <PutToVoteButton />
      </div>
      <LastActivitySection />
      <StatusSection />
      <ApplicationMetadataSection /> {/* New section for application-specific info */}
    </aside>
  );
}
```

### 4. Put to Vote Button Implementation
- Create a new component `PutToVoteButton` that triggers the sponsorship flow
- Position it prominently at the top of the sidebar
- Leverage the existing sponsorship signature functionality from `candidate-screen.jsx`
- Adapt the dialog UI to be more specific to applications
- Ensure proper handling of signatures and expirations

```jsx
function PutToVoteButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  return (
    <>
      <Button 
        variant="primary"
        fullWidth
        onClick={() => setIsDialogOpen(true)}
      >
        Put to vote
      </Button>
      
      {isDialogOpen && (
        <SponsorDialog 
          onClose={() => setIsDialogOpen(false)}
          // Other props needed for sponsorship
        />
      )}
    </>
  );
}
```

### 5. Main Content Container
- Use the existing `MainContentContainer` component with sidebar
- Ensure proper responsive behavior for different screen sizes
- Adapt content display for application-specific information

```jsx
<MainContentContainer
  sidebarWidth="28rem"
  sidebarGap="6rem"
  sidebar={isDesktopLayout ? <Sidebar /> : null}
>
  <ApplicationContent />
</MainContentContainer>
```

### 6. Header and Content Area
- Include application title and metadata in the main content area
- Format application-specific content appropriately
- Ensure the content area has proper spacing and layout

```jsx
function ApplicationContent() {
  return (
    <div className="application-content">
      <h1>{application.title}</h1>
      <ApplicationBody />
      <ActivityFeed />
    </div>
  );
}
```

### 7. Route Configuration
- Add a new route in Next.js configuration for the application screen
- Ensure proper handling of application IDs in the URL
- Update application page component to use the new ApplicationScreen

### 8. Data Fetching and State Management
- Adapt existing data fetching logic to work with applications
- Ensure proper loading states and error handling
- Implement necessary hooks or utilities for application-specific data

### 9. Mobile View Adjustments
- For mobile view, move the "Put to vote" button to a fixed position at the bottom of the screen
- Ensure proper responsive behavior for the button across all screen sizes
- Consider a floating action button pattern for mobile

### 10. Application-Specific UI Elements
- Design and implement any additional UI elements specific to applications
- Consider special formatting for application data like funding requests, timelines, etc.
- Ensure consistent styling with the rest of the application

### 11. Testing Plan
- Unit tests for new components
- Integration tests for the application screen workflow
- UI tests to ensure responsive design works correctly

## Next Steps
1. Create the application-screen.jsx file
2. Implement the basic structure based on topic-screen.jsx
3. Modify the sidebar to add the "Put to vote" button at the top and remove participants
4. Implement the sponsorship dialog for applications
5. Connect to the existing sponsorship signature flow
6. Add application-specific styling and UI elements
7. Test the implementation thoroughly