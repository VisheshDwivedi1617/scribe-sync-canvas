
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { 
  Undo, Redo, PenTool, Eraser, Download, 
  ZoomIn, ZoomOut, Hand, Maximize2, Trash2,
  ChevronLeft, ChevronRight, Pencil, Smartphone
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";
import PenDataInterpreter, { PenStroke } from "@/services/PenDataInterpreter";
import { useNotebook } from "@/contexts/NotebookContext";

interface DigitalCanvasProps {
  className?: string;
}

const DigitalCanvas = ({ className }: DigitalCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [tool, setTool] = useState<"pen" | "finger" | "eraser" | "hand">("pen");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(2);
  const [scale, setScale] = useState(1);
  const { toast } = useToast();
  
  // Get notebook context
  const { 
    strokes, 
    addStroke, 
    updateStrokes, 
    goToNextPage, 
    goToPreviousPage,
    getCurrentPageIndex,
    getTotalPages,
    currentPage,
    clearStrokes
  } = useNotebook();
  
  // Strokes for undo/redo
  const [redoStack, setRedoStack] = useState<PenStroke[]>([]);
  
  // Set up canvas and draw existing strokes
  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set initial canvas size
    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      
      // Redraw all strokes after resize
      redrawCanvas();
    };
    
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    
    // Draw initial canvas
    redrawCanvas();
    
    // Set up pen data interpreter handlers
    PenDataInterpreter.setOnNewStroke((stroke) => {
      // Add the stroke to our state via the context
      addStroke(stroke);
      
      // Draw the stroke
      drawStroke(stroke);
    });
    
    return () => {
      window.removeEventListener("resize", resizeCanvas);
      PenDataInterpreter.setOnNewStroke(null);
    };
  }, [addStroke]);
  
  // Redraw when strokes change
  useEffect(() => {
    redrawCanvas();
  }, [strokes]);
  
  // Redraw canvas when page changes
  useEffect(() => {
    redrawCanvas();
    setRedoStack([]);
  }, [currentPage]);
  
  // Redraw all strokes
  const redrawCanvas = () => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    
    // Draw grid lines
    ctx.strokeStyle = "#e5e7eb";
    ctx.lineWidth = 1;
    
    for (let y = 40; y < canvasRef.current.height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvasRef.current.width, y);
      ctx.stroke();
    }
    
    // Draw all strokes
    strokes.forEach(stroke => {
      drawStroke(stroke);
    });
  };
  
  // Draw a single stroke
  const drawStroke = (stroke: PenStroke) => {
    if (!canvasRef.current || stroke.points.length === 0) return;
    
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    
    ctx.stroke();
  };
  
  // Drawing event handlers for mouse
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (tool === "hand") return; // Don't draw if in pan mode
    
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // Start a new stroke
    const newStroke: PenStroke = {
      points: [{ x, y, pressure: 1, timestamp: Date.now() }],
      color: isErasing ? "#ffffff" : color,
      width: isErasing ? lineWidth * 3 : lineWidth,
      id: Date.now().toString()
    };
    
    // Add to strokes
    addStroke(newStroke);
    setRedoStack([]); // Clear redo stack on new drawing
    
    setIsDrawing(true);
  };
  
  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool === "hand" || !canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;
    
    ctx.strokeStyle = isErasing ? "#ffffff" : color;
    ctx.lineWidth = isErasing ? lineWidth * 3 : lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.lineTo(x, y);
    ctx.stroke();
    
    // Update the current stroke
    const updatedStrokes = [...strokes];
    const currentStroke = updatedStrokes[updatedStrokes.length - 1];
    
    if (currentStroke) {
      currentStroke.points.push({ 
        x, y, pressure: 1, timestamp: Date.now() 
      });
      updateStrokes(updatedStrokes);
    }
  };
  
  // Touch events for mobile finger drawing
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (tool !== "finger" || !canvasRef.current) return;
    
    e.preventDefault(); // Prevent scrolling
    
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) / scale;
    const y = (touch.clientY - rect.top) / scale;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    // Start a new stroke
    const newStroke: PenStroke = {
      points: [{ x, y, pressure: 1, timestamp: Date.now() }],
      color: color,
      width: lineWidth,
      id: Date.now().toString()
    };
    
    // Add to strokes
    addStroke(newStroke);
    setRedoStack([]); // Clear redo stack on new drawing
    
    setIsDrawing(true);
  };
  
  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || tool !== "finger" || !canvasRef.current) return;
    
    e.preventDefault(); // Prevent scrolling
    
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const x = (touch.clientX - rect.left) / scale;
    const y = (touch.clientY - rect.top) / scale;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    
    ctx.lineTo(x, y);
    ctx.stroke();
    
    // Update the current stroke
    const updatedStrokes = [...strokes];
    const currentStroke = updatedStrokes[updatedStrokes.length - 1];
    
    if (currentStroke) {
      currentStroke.points.push({ 
        x, y, pressure: 1, timestamp: Date.now() 
      });
      updateStrokes(updatedStrokes);
    }
  };
  
  const handleTouchEnd = () => {
    setIsDrawing(false);
  };
  
  const stopDrawing = () => {
    setIsDrawing(false);
  };
  
  // Undo last stroke
  const handleUndo = () => {
    if (strokes.length === 0) return;
    
    const lastStroke = strokes[strokes.length - 1];
    const newStrokes = strokes.slice(0, -1);
    updateStrokes(newStrokes);
    setRedoStack(prev => [...prev, lastStroke]);
    
    redrawCanvas();
  };
  
  // Redo last undone stroke
  const handleRedo = () => {
    if (redoStack.length === 0) return;
    
    const strokeToRedo = redoStack[redoStack.length - 1];
    setRedoStack(prev => prev.slice(0, -1));
    updateStrokes([...strokes, strokeToRedo]);
    
    redrawCanvas();
  };
  
  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.1, 3));
  };
  
  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  };
  
  const handleToolChange = (newTool: "pen" | "finger" | "eraser" | "hand") => {
    setTool(newTool);
    setIsErasing(newTool === "eraser");
    
    if (newTool === "finger") {
      toast({
        title: "Finger drawing mode",
        description: "Use your finger to draw directly on the canvas",
      });
    }
  };
  
  const handleClear = () => {
    if (!canvasRef.current) return;
    
    clearStrokes();
    redrawCanvas();
    
    toast({
      title: "Canvas cleared",
      description: "Your canvas has been cleared",
    });
  };
  
  const handleSave = () => {
    if (!canvasRef.current) return;
    
    const dataUrl = canvasRef.current.toDataURL("image/png");
    const link = document.createElement("a");
    link.download = `scribe-note-${new Date().toISOString()}.png`;
    link.href = dataUrl;
    link.click();
    
    toast({
      title: "Note saved",
      description: "Your note has been saved to your device",
    });
  };
  
  // Handle page navigation
  const handleNextPage = () => {
    goToNextPage();
  };
  
  const handlePreviousPage = () => {
    goToPreviousPage();
  };
  
  // Get current page info
  const currentPageIndex = getCurrentPageIndex() + 1; // 1-based for display
  const totalPages = getTotalPages();
  
  // Simulate pen data (for demonstration)
  const simulateRealTimeInput = () => {
    if (!canvasRef.current) return;
    
    const ctx = canvasRef.current.getContext("2d");
    if (!ctx) return;
    
    let x = Math.random() * canvasRef.current.width;
    let y = Math.random() * canvasRef.current.height;
    
    const simulateStroke = () => {
      if (!canvasRef.current || !ctx) return;
      
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      ctx.beginPath();
      ctx.moveTo(x, y);
      
      // Create new stroke
      const newStroke: PenStroke = {
        points: [{ x, y, pressure: 1, timestamp: Date.now() }],
        color,
        width: lineWidth,
        id: Date.now().toString()
      };
      
      // Simulate a natural writing flow with slight randomness
      for (let i = 0; i < 10; i++) {
        x += (Math.random() - 0.5) * 20;
        y += (Math.random() - 0.5) * 5;
        ctx.lineTo(x, y);
        ctx.stroke();
        
        // Add point to stroke
        newStroke.points.push({ 
          x, y, pressure: 1, timestamp: Date.now() 
        });
      }
      
      // Add the stroke to our state
      addStroke(newStroke);
    };
    
    // Simulate writing for demonstration
    const interval = setInterval(simulateStroke, 100);
    setTimeout(() => clearInterval(interval), 2000);
  };
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      <div className="bg-white border-b border-gray-200 p-2 flex justify-between items-center overflow-x-auto">
        <div className="flex items-center space-x-1">
          <Button
            variant={tool === "pen" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => handleToolChange("pen")}
            title="Pen"
          >
            <PenTool className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === "finger" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => handleToolChange("finger")}
            title="Finger Drawing"
          >
            <Smartphone className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === "eraser" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => handleToolChange("eraser")}
            title="Eraser"
          >
            <Eraser className="h-4 w-4" />
          </Button>
          <Button
            variant={tool === "hand" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => handleToolChange("hand")}
            title="Hand (Pan)"
          >
            <Hand className="h-4 w-4" />
          </Button>
          
          <div className="h-4 border-r border-gray-300 mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            title="Undo"
            onClick={handleUndo}
            disabled={strokes.length === 0}
          >
            <Undo className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Redo"
            onClick={handleRedo}
            disabled={redoStack.length === 0}
          >
            <Redo className="h-4 w-4" />
          </Button>
          
          <div className="h-4 border-r border-gray-300 mx-1" />
          
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-8 h-8 rounded cursor-pointer border border-gray-300"
            title="Color"
          />
          
          <select
            value={lineWidth}
            onChange={(e) => setLineWidth(Number(e.target.value))}
            className="h-8 rounded border border-gray-300 text-sm px-1"
            title="Line Width"
          >
            <option value="1">Thin</option>
            <option value="2">Medium</option>
            <option value="4">Thick</option>
            <option value="8">Very Thick</option>
          </select>
        </div>
        
        <div className="flex items-center space-x-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePreviousPage}
            disabled={currentPageIndex <= 1}
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-xs font-medium">
            Page {currentPageIndex} of {totalPages}
          </span>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          
          <div className="h-4 border-r border-gray-300 mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            title="Zoom Out"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-medium">{Math.round(scale * 100)}%</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            title="Zoom In"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          
          <div className="h-4 border-r border-gray-300 mx-1" />
          
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            title="Clear"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleSave}
            title="Download"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      <div className="flex-1 relative bg-gray-50 overflow-hidden">
        <div 
          className="absolute inset-0 flex items-center justify-center"
          style={{ transform: `scale(${scale})` }}
        >
          <canvas
            ref={canvasRef}
            className="bg-white shadow-md touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          />
        </div>
      </div>
    </div>
  );
};

export default DigitalCanvas;
