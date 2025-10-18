# AI Rules for Sales Manager Application

## Tech Stack Overview

- **Frontend Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized production builds
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS for utility-first styling with custom design tokens
- **State Management**: TanStack Query (React Query) for server state and caching
- **Routing**: React Router v6 for client-side navigation
- **Backend**: Supabase for authentication, database (PostgreSQL), and edge functions
- **Mobile**: Capacitor for iOS and Android native builds
- **Forms**: React Hook Form with Zod validation
- **Date Handling**: date-fns for date formatting and manipulation

## Library Usage Rules

### UI Components
- **ALWAYS** use shadcn/ui components from `@/components/ui/` for all UI elements
- **DO NOT** install new UI component libraries - shadcn/ui provides everything needed
- For icons, use `lucide-react` which is already installed
- For toasts/notifications, use the existing `sonner` library via `@/components/ui/sonner`
- For dialogs/modals, use `@/components/ui/dialog` from shadcn/ui
- For forms, use `@/components/ui/form` with React Hook Form

### State Management
- **ALWAYS** use TanStack Query (`@tanstack/react-query`) for server state
- Use `useState` and `useContext` for local component state only
- **DO NOT** install Redux, Zustand, or other state management libraries
- Cache server data with appropriate `staleTime` and `gcTime` settings
- Use `queryClient.invalidateQueries()` to refresh data after mutations

### Data Fetching
- **ALWAYS** use Supabase client (`@/integrations/supabase/client`) for database operations
- Use `useQuery` for GET operations (reading data)
- Use `useMutation` for POST/PUT/DELETE operations (writing data)
- **DO NOT** use fetch() or axios directly - use Supabase client methods
- For edge functions, use `supabase.functions.invoke()`

### Forms & Validation
- **ALWAYS** use React Hook Form (`react-hook-form`) for form handling
- Use Zod (`zod`) for schema validation with `@hookform/resolvers/zod`
- Use shadcn/ui form components (`@/components/ui/form`) for consistent styling
- **DO NOT** install Formik or other form libraries

### Styling
- **ALWAYS** use Tailwind CSS utility classes for styling
- Use the custom design tokens defined in `tailwind.config.ts`:
  - Colors: `bg-primary`, `text-muted-foreground`, etc.
  - Shadows: `shadow-soft`, `shadow-medium`, `shadow-strong`
  - Gradients: `bg-gradient-primary`, `bg-gradient-success`
- Use `cn()` utility from `@/lib/utils` to merge Tailwind classes conditionally
- **DO NOT** write custom CSS files - use Tailwind utilities
- For responsive design, use Tailwind breakpoints: `sm:`, `md:`, `lg:`

### Date & Time
- **ALWAYS** use `date-fns` for date formatting and manipulation
- Use `format()` from date-fns with Vietnamese locale (`vi`) when needed
- For date pickers, use `@/components/ui/calendar` (shadcn/ui)
- **DO NOT** install moment.js or other date libraries

### Excel/Spreadsheet Operations
- **ALWAYS** use `xlsx` library for Excel import/export
- Use `XLSX.utils.json_to_sheet()` for creating sheets
- Use `XLSX.utils.sheet_to_json()` for reading sheets
- **DO NOT** install other Excel libraries

### Mobile Development
- Use Capacitor APIs for native features (camera, file system, etc.)
- Test mobile layouts with `useIsMobile()` hook from `@/hooks/use-mobile`
- Use responsive Tailwind classes for mobile-first design
- **DO NOT** install React Native or other mobile frameworks

## Code Organization Rules

### File Structure
- **Pages**: Place in `src/pages/` - one file per route
- **Components**: Place in `src/components/` - organize by feature
- **Hooks**: Place in `src/hooks/` - custom React hooks
- **Utils**: Place in `src/lib/` - utility functions and helpers
- **Types**: Place in `src/types/` - TypeScript type definitions
- **Contexts**: Place in `src/contexts/` - React context providers

### Component Guidelines
- Keep components under 300 lines - split into smaller components if needed
- Use TypeScript interfaces for all props
- Export components as default for pages, named exports for reusable components
- Use `React.memo()` for expensive components that re-render frequently
- Use `useMemo()` and `useCallback()` to optimize performance

### Naming Conventions
- **Components**: PascalCase (e.g., `ProductList.tsx`)
- **Hooks**: camelCase with "use" prefix (e.g., `useProductVariants.ts`)
- **Utils**: camelCase (e.g., `formatVND.ts`)
- **Types**: PascalCase (e.g., `FacebookComment`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `TPOS_CONFIG`)

## Database & Supabase Rules

### Database Operations
- **ALWAYS** use Row Level Security (RLS) policies for all tables
- Use `authenticated` role for user-specific queries
- Use `.select()` to specify columns - avoid `SELECT *` in production
- Use `.single()` when expecting one result, `.maybeSingle()` when result might not exist
- Use `.order()` to sort results consistently

### Real-time Subscriptions
- Use Supabase real-time for live updates when needed
- Always clean up subscriptions in `useEffect` cleanup function
- Use `queryClient.invalidateQueries()` in subscription callbacks

### Edge Functions
- Place in `supabase/functions/` directory
- Each function in its own folder with `index.ts`
- Use CORS headers for all responses
- Handle authentication manually (verify_jwt is false by default)
- Use environment variables for secrets (SUPABASE_URL, SUPABASE_ANON_KEY, etc.)

## Business Logic Rules

### TPOS Integration
- Use `@/lib/tpos-api.ts` for all TPOS API calls
- Store TPOS bearer token in `tpos_config` table
- Use `getActiveTPOSToken()` to retrieve current token
- Cache TPOS data appropriately to reduce API calls
- Handle TPOS errors gracefully with user-friendly messages

### Product Management
- Use `product_code` as the primary identifier for products
- Support `base_product_code` for variant relationships
- Auto-detect supplier from product name using `detectSupplierFromProductName()`
- Generate product codes automatically with `generateProductCode()`
- Support multiple product images stored in `product_images` array

### Order Management
- Support both purchase orders (from suppliers) and live orders (from customers)
- Track order status: pending, confirmed, received, completed, cancelled
- Link orders to products via `product_id` foreign key
- Support goods receiving with discrepancy tracking
- Enable TPOS synchronization for order data

### Customer Management
- Store customer data with `facebook_id` for social media integration
- Track customer status: Bình thường, Bom hàng, Cảnh báo, VIP, etc.
- Support info_status: incomplete, complete, synced_tpos
- Enable batch fetching from TPOS for customer details
- Support Excel import/export for bulk operations

### Live Session Management
- Create live sessions with 6 phases (3 days × 2 phases per day)
- Track products per phase with prepared_quantity and sold_quantity
- Support quick order creation from Facebook comments
- Enable product type classification: hang_dat, hang_le, hang_so_luong
- Auto-generate order images for social media posting

## Performance Optimization Rules

### Query Optimization
- Use `staleTime` and `gcTime` in React Query to reduce unnecessary fetches
- Implement pagination for large datasets (50-100 items per page)
- Use `select` to fetch only needed columns from database
- Debounce search inputs with `useDebounce()` hook (300ms default)
- Cache frequently accessed data in localStorage when appropriate

### Image Handling
- Compress images before upload if > 1MB using `compressImage()`
- Store images in Supabase Storage bucket `purchase-images`
- Use lazy loading for image lists
- Support multiple image formats (JPEG, PNG, WebP)
- Display placeholder icons when images are missing

### Mobile Optimization
- Use `useIsMobile()` hook to detect mobile devices
- Render different layouts for mobile vs desktop
- Use mobile-optimized components (cards instead of tables)
- Implement touch-friendly UI elements (larger buttons, spacing)
- Test all features on mobile viewport

## Security Rules

### Authentication
- Use Supabase Auth with email/password (format: `username@internal.app`)
- Protect all routes with `<ProtectedRoute>` wrapper
- Check user roles with `useIsAdmin()` hook for admin features
- Store user profiles in `profiles` table linked to auth.users
- Auto-create profile on user signup with trigger

### Data Access
- Implement RLS policies for all tables
- Use `auth.uid()` in RLS policies for user-specific data
- Validate all user inputs on both client and server
- Sanitize data before database operations
- Use parameterized queries to prevent SQL injection

### API Security
- Store sensitive tokens in Supabase Secrets (environment variables)
- Use HTTPS for all external API calls
- Validate API responses before processing
- Handle API errors gracefully without exposing sensitive info
- Rate limit API calls to prevent abuse

## Error Handling Rules

### User-Facing Errors
- **ALWAYS** show user-friendly error messages with `toast()`
- Provide actionable error messages (what went wrong + how to fix)
- Use appropriate toast variants: `default`, `destructive`, `success`
- Log detailed errors to console for debugging
- Never expose technical details or stack traces to users

### API Error Handling
- Catch all API errors with try/catch blocks
- Check response status codes and handle appropriately
- Provide fallback UI when data fails to load
- Retry failed requests with exponential backoff when appropriate
- Show loading states during async operations

### Form Validation
- Validate on both client (Zod schema) and server (RLS policies)
- Show field-level errors with `<FormMessage>` component
- Disable submit buttons during validation/submission
- Clear errors when user corrects input
- Provide helpful validation messages

## Testing & Debugging Rules

### Development Tools
- Use React DevTools for component debugging
- Use TanStack Query DevTools for cache inspection
- Use Supabase Studio for database management
- Test edge functions locally with Supabase CLI
- Use browser console for client-side debugging

### Code Quality
- Follow TypeScript strict mode (disabled for this project but recommended)
- Use ESLint rules defined in `eslint.config.js`
- Keep functions focused and single-purpose
- Write descriptive variable and function names
- Add comments for complex business logic

### Mobile Testing
- Test on actual devices when possible
- Use Chrome DevTools mobile emulation for quick testing
- Test touch interactions and gestures
- Verify responsive layouts at different screen sizes
- Test offline behavior and error states

## Feature-Specific Rules

### Barcode Scanner
- Use `BarcodeScannerContext` to manage scanner state
- Enable scanner per page with `enabledPage` setting
- Listen for `barcode-scanned` custom event
- Auto-add products to live sessions when scanned
- Show confirmation dialog when navigating to scanner page

### Facebook Comments Integration
- Use edge functions to fetch comments from TPOS API
- Cache comment data with React Query (5 min staleTime)
- Support real-time updates with auto-refresh
- Track new comments with visual indicators
- Link comments to TPOS orders via `facebook_comment_id`

### Variant Generation
- Use `@/lib/variant-code-generator.ts` for automatic variant creation
- Support size text, size number, and color attributes
- Generate product codes with collision handling
- Create cartesian product for multiple attributes
- Sync variants to TPOS with proper attribute mapping

### Excel Import/Export
- Support template download for user guidance
- Validate data before import with clear error messages
- Show progress indicators for large imports
- Support batch operations (1000 rows per batch)
- Handle duplicate detection and updates

### Goods Receiving
- Track expected vs received quantities
- Calculate discrepancies automatically
- Support item-level notes and conditions
- Update product stock on receiving confirmation
- Link to purchase orders with foreign keys

## Deployment Rules

### Build Process
- Run `npm run build` to create production build
- Test build locally with `npm run preview`
- Ensure all environment variables are set
- Check for TypeScript errors before deploying
- Verify mobile builds with Capacitor sync

### Environment Variables
- Store in `.env` file (not committed to git)
- Use `VITE_` prefix for client-side variables
- Access with `import.meta.env.VITE_*`
- Never expose secrets in client code
- Use Supabase Secrets for server-side secrets

### Database Migrations
- Create migrations in `supabase/migrations/`
- Test migrations locally before deploying
- Use descriptive migration names with timestamps
- Never modify existing migrations - create new ones
- Backup database before running migrations

## Common Patterns

### Data Fetching Pattern
```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ["resource-name", id],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("table_name")
      .select("*")
      .eq("id", id);
    
    if (error) throw error;
    return data;
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
});
```

### Mutation Pattern
```typescript
const mutation = useMutation({
  mutationFn: async (newData) => {
    const { error } = await supabase
      .from("table_name")
      .insert(newData);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["resource-name"] });
    toast.success("Operation successful");
  },
  onError: (error) => {
    toast.error(`Error: ${error.message}`);
  },
});
```

### Dialog Pattern
```typescript
const [isOpen, setIsOpen] = useState(false);

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
    </DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

### Mobile Responsive Pattern
```typescript
const isMobile = useIsMobile();

<div className={cn(
  "container",
  isMobile ? "p-4 space-y-3" : "p-6 space-y-6"
)}>
  {/* Content */}
</div>
```

## Anti-Patterns (DO NOT DO)

### ❌ Don't Install Unnecessary Libraries
- Don't install UI libraries (Material-UI, Ant Design, etc.) - use shadcn/ui
- Don't install state management (Redux, MobX) - use React Query
- Don't install CSS frameworks (Bootstrap, Foundation) - use Tailwind
- Don't install date libraries (moment.js, dayjs) - use date-fns
- Don't install HTTP clients (axios) - use Supabase client

### ❌ Don't Bypass Existing Patterns
- Don't create custom form components - use shadcn/ui forms
- Don't write raw SQL - use Supabase query builder
- Don't use inline styles - use Tailwind classes
- Don't create custom hooks for data fetching - use React Query
- Don't bypass authentication - use `<ProtectedRoute>`

### ❌ Don't Ignore TypeScript
- Don't use `any` type - define proper interfaces
- Don't disable TypeScript errors - fix them
- Don't skip type definitions for props
- Don't ignore type errors in console
- Don't use `@ts-ignore` without good reason

### ❌ Don't Hardcode Values
- Don't hardcode API URLs - use environment variables
- Don't hardcode colors - use Tailwind theme colors
- Don't hardcode text - consider i18n in future
- Don't hardcode IDs - use dynamic values
- Don't hardcode dates - use date-fns for formatting

## Special Considerations

### Vietnamese Language Support
- All UI text is in Vietnamese
- Use Vietnamese locale for date formatting (`vi` from date-fns)
- Support Vietnamese diacritics in search and filtering
- Use `convertVietnameseToUpperCase()` for text normalization
- Format currency as VND with `formatVND()` utility

### TPOS System Integration
- TPOS is the external POS system used by the business
- Store TPOS credentials in `tpos_config` table
- Use edge functions for TPOS API calls to hide credentials
- Cache TPOS data to reduce API calls
- Handle TPOS API rate limits with delays between requests

### Supplier Detection
- Auto-detect supplier from product names using patterns
- Pattern: `ddmm A## product description` → Supplier: A##
- Use `detectSupplierFromProductName()` utility
- Support multiple supplier name formats
- Update supplier info when product names change

### Variant Management
- Support multiple variant types: size text, size number, color
- Generate variant codes automatically with collision handling
- Create cartesian products for multi-attribute variants
- Sync variants to TPOS with proper attribute mapping
- Support base product + child variants relationship

### Image Management
- Auto-compress images > 1MB before upload
- Store in Supabase Storage bucket `purchase-images`
- Support multiple images per product
- Fetch TPOS images lazily and cache in database
- Generate order images for social media with text overlay

## Maintenance Rules

### Code Updates
- Test changes locally before committing
- Update related queries when changing data structure
- Invalidate affected caches after mutations
- Update TypeScript types when schema changes
- Document complex business logic with comments

### Database Changes
- Create migrations for schema changes
- Update RLS policies when adding tables
- Test migrations on local Supabase instance
- Update TypeScript types after schema changes
- Backup data before major changes

### Dependency Updates
- Keep dependencies up to date monthly
- Test thoroughly after major version updates
- Check for breaking changes in changelogs
- Update lock files after dependency changes
- Remove unused dependencies

---

**Last Updated**: January 2025
**Version**: 1.0.0