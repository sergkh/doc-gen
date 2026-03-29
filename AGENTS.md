# AGENTS.md - Project Documentation for AI Assistants

## Project Overview

This is a **University Course Documentation Generator** built to collect, process, and manage information about university courses and automatically generate various educational documents using AI and template processing.

## Technology Stack

### Runtime & Backend
- **Bun**: Primary runtime environment for executing TypeScript/JavaScript
- **Bun HTTP Server**: Handles all HTTP requests and API endpoints
- **Bun SQLite**: Database access and storage for courses, teachers, results, and templates
- **TypeScript**: Strongly-typed language for both frontend and backend

### Frontend
- **React 19**: UI framework for building interactive components
- **React Router 7**: Client-side routing for single-page application
- **TailwindCSS 4**: Utility-first CSS framework for styling
- **React Flow**: Graph visualization library for course dependencies
- **FontAwesome**: Icon library for UI elements
- **React Hot Toast**: Toast notifications for user feedback

### Document Processing
- **OpenAI API**: AI-powered content generation for course materials
- **docxtemplater**: Template-based DOCX document generation
- **mammoth**: DOCX file parsing and text extraction
- **pdf-parse**: PDF file parsing capabilities

### Other Key Libraries
- **React Dropzone**: File upload functionality
- **Zod**: Schema validation
- **Cheerio**: HTML/XML parsing for document processing

## Project Purpose

The system is designed to help university staff:

1. **Manage Course Information**
   - Store and organize course syllabi and curricula
   - Track prerequisites and postrequisites
   - Manage course topics, assessments, and learning outcomes
   - Associate courses with teachers and specialties

2. **Manage Learning Outcomes & Competencies**
   - Define general competencies (ЗК - Загальні компетентності)
   - Define special competencies (СК - Спеціальні компетентності)
   - Define learning outcomes (РН - Результати навчання)
   - Link outcomes to specific courses
   - Visualize outcome coverage across curriculum

3. **Generate Educational Documents**
   - Create course syllabi, work programs, and methodological materials
   - Use AI to generate course descriptions, objectives, and questions
   - Apply templates with custom parameters
   - Export documents in DOCX format

4. **Visualize Curriculum Structure**
   - Display course dependency graphs
   - Show prerequisite/postrequisite relationships
   - Identify missing or mismatched course references
   - View results/competencies matrices

## Project Structure

```
/src
  /api                 # Backend API endpoints
    /utils             # API utilities (file handling, etc.)
    courses.ts         # Course management endpoints
    results.ts         # Learning outcomes/competencies endpoints
    teachers.ts        # Teacher management endpoints
    templates.ts       # Document template endpoints
    generation.ts      # AI content generation endpoints
    specialties.ts     # Academic specialty endpoints
    
  /client              # Frontend React application
    /components        # Reusable React components
    /pages             # Route-based page components
    /util              # Frontend utilities
    courses.ts         # Course API client functions
    results.ts         # Results API client functions
    teachers.ts        # Teachers API client functions
    templates.ts       # Templates API client functions
    specialties.ts     # Specialties API client functions
    
  /stores              # Data layer
    db.ts              # Database access layer
    models.ts          # TypeScript type definitions
    schema.sql         # Database schema
    
  /docx                # Document processing
    parse.ts           # DOCX parsing logic
    render.ts          # DOCX template rendering
    opp-results.ts     # Parse educational program results
    structured-parser.ts # Advanced parsing utilities
    transformations.ts # Data transformation utilities
    verification.ts    # Data validation
    
  /ai                  # AI integration
    common.ts          # Shared AI utilities
    extractor.ts       # Extract information using AI
    generator.ts       # Generate content using AI
    
  /parsing             # Additional parsing utilities
    lit-parser.ts      # Literature list parsing
    utils.ts           # Parsing helper functions
    
  App.tsx              # Main React application component
  index.tsx            # Application entry point
  frontend.tsx         # Frontend initialization
```

## Key Data Models

### Course
- **Basic Info**: ID, name, teacher, specialty, area
- **Academic Details**: OK number, credits, hours, control type (exam/credit)
- **Dependencies**: Prerequisites, postrequisites (course names as strings)
- **Learning Outcomes**: Associated competencies and results (by ID)
- **Schedule**: Semesters, attestations, topics
- **Literature**: Main, additional, and internet resources
- **Generated Content**: AI-generated descriptions, objectives, questions

### Teacher
- **Info**: Name, email, position, academic title
- **Alternative Names**: For matching in documents
- **Publications**: Linked research outputs

### CourseResult (Learning Outcome/Competency)
- **Type**: ЗК (General), СК (Special), or РН (Learning Outcome)
- **Number**: Sequential number within type
- **Specialty**: Associated academic specialty
- **Description**: Text description of the outcome

### Specialty
- **Info**: Code, name, area, qualification
- **Disciplines**: List of required courses with OK numbers
- **Results**: Associated learning outcomes and competencies

### Template
- **File**: DOCX template file path
- **Parameters**: Custom parameters for template rendering
- **Prompts**: AI prompts for generating content

## API Architecture

### RESTful Endpoints Pattern
```
GET    /api/courses           # List all courses
POST   /api/courses           # Create new course
GET    /api/courses/:id       # Get course details
PUT    /api/courses/:id       # Update course
DELETE /api/courses/:id       # Delete course
POST   /api/courses/parse-docx # Upload and parse syllabus
```

Similar patterns for:
- `/api/teachers`
- `/api/results`
- `/api/specialties`
- `/api/templates`

### Special Endpoints
- `/api/generation/course/:courseId` - Generate AI content for course
- `/api/generation/topic/:topicId` - Generate AI content for topic
- `/api/results/parse` - Parse learning outcomes from OPP document
- `/api/specialties/:id/results` - Get results for specialty

## Database Schema

Uses SQLite with tables for:
- `courses` - Course information
- `teachers` - Teacher profiles
- `course_results` - Learning outcomes and competencies
- `specialties` - Academic specialties
- `templates` - Document templates
- `topics` - Course topics/modules

JSON fields store complex data structures (CourseData, GeneratedCourseData, etc.)

## AI Integration

### OpenAI Usage
- Generates course descriptions and objectives
- Creates study questions and quiz content
- Extracts structured information from documents
- Supports multiple models and custom prompts

### Template Processing
- Uses docxtemplater for DOCX generation
- Supports custom placeholders and loops
- Integrates AI-generated content into templates
- Handles complex data structures and formatting

## File Upload & Processing

### Supported Formats
- **DOCX**: Course syllabi, work programs, OPP documents
- **PDF**: Reference materials (parsed but limited generation)

### Upload Flow
1. File uploaded via drag-and-drop or file picker
2. Server generates hash for deduplication
3. File saved to `/uploads/` directory
4. Document parsed and data extracted
5. Data validated and stored in database
6. User can edit and generate final documents

## Frontend Pages

### Main Pages
- **CoursesList** (`/courses`) - Browse and manage courses
- **CourseEdit** (`/courses/:id`) - Edit course details
- **CoursesWithResults** (`/courses/results`) - View courses with their outcomes
- **ResultsList** (`/results`) - Manage learning outcomes by specialty
- **ResultsMatrix** (`/results/matrix`) - Matrix view of course-outcome mappings
- **TeachersList** (`/teachers`) - Manage teacher profiles
- **TemplatesList** (`/templates`) - Manage document templates
- **GeneratorPage** (`/`) - Generate documents from templates

## Development Workflow

### Running the Project
```bash
bun install          # Install dependencies
bun run dev          # Start development server with hot reload
bun run build        # Build for production
bun run start        # Run production build
```

### Key Development Points
1. **Hot Reload**: Bun's `--hot` flag enables instant updates
2. **Type Safety**: Full TypeScript support across stack
3. **Component Reusability**: Shared components in `/client/components`
4. **API Client Pattern**: Frontend functions mirror backend endpoints
5. **State Management**: React hooks (useState, useEffect, useMemo)

## Important Concepts for AI Assistants

### Course Dependencies
- **Prerequisites** and **postrequisites** are stored as **course names** (strings)
- Matching is done by **normalized course name** (lowercase, trimmed)
- Missing courses should be highlighted but not cause errors
- Graph visualization uses these for hierarchical layout

### Ukrainian Language
- UI text is in Ukrainian (Дисципліни, Результати, etc.)
- Document templates are Ukrainian academic formats
- Data validation respects Ukrainian academic standards

### Document Generation Flow
1. User selects template
2. System loads course data and related information
3. AI generates missing content based on prompts
4. Data merged with template using docxtemplater
5. DOCX file generated and downloaded

### Learning Outcomes Matrix
- Courses map to multiple learning outcomes (ЗК, СК, РН)
- Matrix shows which outcomes each course covers
- Helps ensure curriculum completeness
- Identifies gaps in outcome coverage

## Common Tasks

### Adding a New Page
1. Create component in `/src/client/pages/`
2. Add route in `/src/App.tsx`
3. Add navigation link in relevant pages
4. Use existing patterns for data loading and state

### Adding a New API Endpoint
1. Add handler in appropriate `/src/api/*.ts` file
2. Create client function in `/src/client/*.ts`
3. Update types in `/src/stores/models.ts` if needed
4. Follow RESTful naming conventions

### Modifying Database Schema
1. Update `/src/stores/schema.sql`
2. Update type definitions in `/src/stores/models.ts`
3. Update database access functions in `/src/stores/db.ts`
4. Migration may require manual database updates

## Best Practices for AI Assistants

1. **Maintain Type Safety**: Always update TypeScript types when changing data structures
2. **Follow Existing Patterns**: Use similar code style and structure as existing components
3. **Handle Errors Gracefully**: Use try-catch blocks and show user-friendly error messages
4. **Optimize Performance**: Use React.memo, useMemo, useCallback for expensive operations
5. **Consistent Styling**: Use TailwindCSS utility classes matching existing design system
6. **Validate Input**: Check data before saving to prevent corruption
7. **Test File Operations**: Ensure file uploads and parsing work correctly
8. **Consider Mobile**: Responsive design using Tailwind breakpoints
