import { useEffect, useState, useMemo, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle } from "@fortawesome/free-solid-svg-icons";
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap, 
  useNodesState, 
  useEdgesState,
  type Connection,
  type Edge,
  type Node,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { Course } from "@/stores/models";
import { formatDisciplineCode, loadAllCourses } from "../courses";
import dagre from '@dagrejs/dagre';

// Layout algorithm using dagre
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  const nodeWidth = 180;
  const nodeHeight = 100;
  
  dagreGraph.setGraph({ rankdir: direction, ranksep: 100, nodesep: 50 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

function buildCoursesGraph(courses: Course[]) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const courseMap = new Map<string, Course>();
  const missingCourseSet = new Set<string>();
  const processedMissingNodes = new Set<string>();

  // Build a map of course names to courses (case-insensitive)
  courses.forEach(course => {
    const normalizedName = course.name.toLowerCase().trim();
    courseMap.set(normalizedName, course);
  });

  // Create nodes for all existing courses
  courses.forEach(course => {
    const nodeId = `course-${course.id}`;
    const node: Node = {
      id: nodeId,
      type: 'default',
      data: {
        label: (
          <div className="text-center p-2">
            <div className="font-bold text-sm text-amber-200">
              { formatDisciplineCode(course.data.ok_no) }
            </div>
            <div className="text-xs mt-1">{course.name}</div>              
          </div>
        ),
        courseId: course.id,
        courseName: course.name,
        isMissing: false
      },
      position: { x: 0, y: 0 },
      style: {
        background: '#18181b',
        color: '#fffbeb',
        border: '2px solid #fffbeb',
        borderRadius: '12px',
        padding: '8px',
        width: '180px',
        minHeight: '100px'
      }
    };
    
    nodes.push(node);
  });

  // Process prerequisites and postrequisites to create edges
  courses.forEach(course => {
    const currentCourseNode = nodes.find(n => n.data.courseId === course.id);
    if (!currentCourseNode) return;

    // Process prerequisites
    processPrerequisites(
      course, 
      currentCourseNode, 
      courseMap, 
      nodes, 
      edges, 
      missingCourseSet, 
      processedMissingNodes
    );

    // Process postrequisites
    processPostrequisites(
      course, 
      currentCourseNode, 
      courseMap, 
      nodes, 
      edges, 
      missingCourseSet, 
      processedMissingNodes
    );
  });

  return { 
    nodes, 
    edges, 
    missingCourses: Array.from(missingCourseSet) 
  };
}

function processPrerequisites(
  course: Course,
  currentCourseNode: Node,
  courseMap: Map<string, Course>,
  nodes: Node[],
  edges: Edge[],
  missingCourseSet: Set<string>,
  processedMissingNodes: Set<string>
) {
  course.data.prerequisites?.forEach(prereqName => {
    if (!prereqName || prereqName.trim() === '') return;
    
    const normalizedPrereqName = prereqName.toLowerCase().trim();
    const prereqCourse = courseMap.get(normalizedPrereqName);
    
    if (prereqCourse) {
      // Found matching course - create edge from prerequisite to current course
      const prereqNode = nodes.find(n => n.data.courseId === prereqCourse.id);
      
      if (prereqNode) {
        const edgeId = `edge-prereq-${prereqNode.id}-to-${currentCourseNode.id}`;
        edges.push(createPrerequisiteEdge(prereqNode.id, currentCourseNode.id, edgeId));
      }
    } else {
      // Missing prerequisite - track it and create a red node
      missingCourseSet.add(prereqName);
      
      const missingNodeId = `missing-${normalizedPrereqName.replace(/\s+/g, '-')}`;
      
      // Only create the node if we haven't processed it yet
      if (!processedMissingNodes.has(missingNodeId)) {
        nodes.push(createMissingCourseNode(prereqName, missingNodeId));
        processedMissingNodes.add(missingNodeId);
      }
      
      // Create edge from missing prerequisite to current course
      const edgeId = `edge-prereq-missing-${missingNodeId}-to-${currentCourseNode.id}`;
      edges.push(createMissingPrerequisiteEdge(missingNodeId, currentCourseNode.id, edgeId));
    }
  });
}

function processPostrequisites(
  course: Course,
  currentCourseNode: Node,
  courseMap: Map<string, Course>,
  nodes: Node[],
  edges: Edge[],
  missingCourseSet: Set<string>,
  processedMissingNodes: Set<string>
) {
  course.data.postrequisites?.forEach(postreqName => {
    if (!postreqName || postreqName.trim() === '') return;
    
    const normalizedPostreqName = postreqName.toLowerCase().trim();
    const postreqCourse = courseMap.get(normalizedPostreqName);
    
    if (postreqCourse) {
      // Found matching course - create edge from current course to postrequisite
      const postreqNode = nodes.find(n => n.data.courseId === postreqCourse.id);
      if (postreqNode) {
        const edgeId = `edge-postreq-${currentCourseNode.id}-to-${postreqNode.id}`;
        edges.push(createPostrequisiteEdge(currentCourseNode.id, postreqNode.id, edgeId));
      }
    } else {
      // Missing postrequisite - track it and create a red node
      missingCourseSet.add(postreqName);
      
      const missingNodeId = `missing-${normalizedPostreqName.replace(/\s+/g, '-')}`;
      
      // Only create the node if we haven't processed it yet
      if (!processedMissingNodes.has(missingNodeId)) {
        nodes.push(createMissingCourseNode(postreqName, missingNodeId));
        processedMissingNodes.add(missingNodeId);
      }
      
      // Create edge from current course to missing postrequisite
      const edgeId = `edge-postreq-${currentCourseNode.id}-to-missing-${missingNodeId}`;
      edges.push(createMissingPostrequisiteEdge(currentCourseNode.id, missingNodeId, edgeId));
    }
  });
}

function createPrerequisiteEdge(sourceId: string, targetId: string, edgeId: string): Edge {
  return {
    id: edgeId,
    source: sourceId,
    target: targetId,
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#f59e0b', strokeWidth: 2 },
    markerEnd: { 
      type: MarkerType.ArrowClosed, 
      width: 20, 
      height: 20, 
      color: '#f59e0b' 
    },
    label: 'prerequisite',
    labelStyle: { fill: '#f59e0b', fontSize: 10 },
    labelBgStyle: { fill: '#18181b' }
  };
}

function createPostrequisiteEdge(sourceId: string, targetId: string, edgeId: string): Edge {
  return {
    id: edgeId,
    source: sourceId,
    target: targetId,
    type: 'smoothstep',
    animated: false,
    style: { stroke: '#10b981', strokeWidth: 2 },
    markerEnd: { 
      type: MarkerType.ArrowClosed, 
      width: 20, 
      height: 20, 
      color: '#10b981' 
    },
    label: 'postrequisite',
    labelStyle: { fill: '#10b981', fontSize: 10 },
    labelBgStyle: { fill: '#18181b' }
  };
}

function createMissingPrerequisiteEdge(sourceId: string, targetId: string, edgeId: string): Edge {
  return {
    id: edgeId,
    source: sourceId,
    target: targetId,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '5,5' },
    markerEnd: { 
      type: MarkerType.ArrowClosed, 
      width: 20, 
      height: 20, 
      color: '#ef4444' 
    }
  };
}

function createMissingPostrequisiteEdge(sourceId: string, targetId: string, edgeId: string): Edge {
  return {
    id: edgeId,
    source: sourceId,
    target: targetId,
    type: 'smoothstep',
    animated: true,
    style: { stroke: '#ef4444', strokeWidth: 2, strokeDasharray: '5,5' },
    markerEnd: { 
      type: MarkerType.ArrowClosed, 
      width: 20, 
      height: 20, 
      color: '#ef4444' 
    }
  };
}

function createMissingCourseNode(courseName: string, nodeId: string): Node {
  return {
    id: nodeId,
    type: 'default',
    data: {
      label: (
        <div className="text-center p-2">
          <div className="font-bold text-sm text-red-400 flex items-center justify-center gap-1">
            <span>⚠️</span>
          </div>
          <div className="text-xs mt-1">{courseName}</div>
          <div className="text-xs text-red-300 mt-1">(не знайдено)</div>
        </div>
      ),
      courseName: courseName,
      isMissing: true
    },
    position: { x: 0, y: 0 },
    style: {
      background: '#7f1d1d',
      color: '#fecaca',
      border: '2px solid #ef4444',
      borderRadius: '12px',
      padding: '8px',
      width: '180px',
      minHeight: '100px'
    }
  };
}

export default function CourseGraph() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showMissingCourses, setShowMissingCourses] = useState(false);

  // Load all courses
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const coursesData = await loadAllCourses();
        setCourses(coursesData);
      } catch (err) {
        console.error("Error loading courses:", err);
        setError("Не вдалося завантажити дані про дисципліни");
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Create nodes and edges for the graph
  const { nodes: initialNodes, edges: initialEdges, missingCourses } = useMemo(() => buildCoursesGraph(courses), [courses]);

  // Apply layout algorithm
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    return getLayoutedElements(initialNodes, initialEdges);
  }, [initialNodes, initialEdges]);

  // React Flow state management
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes and edges when layout changes
  useEffect(() => {
    const { nodes: newLayoutedNodes, edges: newLayoutedEdges } = getLayoutedElements( initialNodes, initialEdges);
    setNodes(newLayoutedNodes);
    setEdges(newLayoutedEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback((params: Connection) => {
    // Prevent manual connections in this view
    console.log('Connection attempt:', params);
  }, []);

  if (isLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-amber-50 font-mono text-lg">Завантаження даних про дисципліни...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 font-mono text-lg mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className="bg-zinc-900 border-2 border-amber-50 rounded-xl px-4 py-2 text-amber-50 font-mono hover:bg-zinc-800 transition-colors"
          >
            Спробувати ще раз
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Header */}
      <div className="bg-zinc-950 border-b-2 border-amber-50 p-4">
        <div className="mx-auto flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h1 className="font-mono text-2xl text-amber-50">Граф залежностей дисциплін</h1>
          </div>

           {missingCourses.length > 0 && (
            <div className="bg-red-950 border-2 border-red-500 rounded-lg text-red-200 text-sm font-mono">
              <button
                onClick={() => setShowMissingCourses(!showMissingCourses)}
                className="w-full flex items-center justify-between p-3 hover:bg-red-900/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="mt-0.5" />
                  <span className="font-bold">
                    Знайдено {missingCourses.length} відсутніх дисциплін
                  </span>
                </div>
                <span className="text-lg">
                  {showMissingCourses ? '−' : '+'}
                </span>
              </button>
              
              {showMissingCourses && (
                <div className="p-3 pt-0 border-t-2 border-red-500/30">
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    {missingCourses.map((courseName, index) => (
                      <li key={index}>{courseName}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Graph */}
      <div className="flex-1 relative bg-zinc-950">
        {nodes.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-amber-50 font-mono text-lg">
              {courses.length === 0 
                ? "Немає дисциплін для відображення" 
                : "Не знайдено дисциплін, що відповідають фільтру"}
            </div>
          </div>
        ) : (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            fitView
            fitViewOptions={{ padding: 0.2, maxZoom: 1.5 }}
            minZoom={0.1}
            maxZoom={2}
            defaultEdgeOptions={{
              type: 'smoothstep',
            }}
          >
            <Background color="#374151" gap={16} size={1} />
            <Controls className="bg-zinc-900 border-2 border-amber-50 rounded-lg" />
            <MiniMap 
              className="bg-zinc-900 border-2 border-amber-50 rounded-lg"
              nodeColor={(node) => {
                if (node.data.isMissing) return '#ef4444';
                return '#fffbeb';
              }}
              maskColor="rgba(24, 24, 27, 0.8)"
            />
          </ReactFlow>
        )}

      </div>
    </div>
  );
}