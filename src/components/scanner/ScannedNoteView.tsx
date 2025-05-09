
import React, { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Edit, Save, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useNotebook } from "@/contexts/NotebookContext";
import OCRService, { OCRLanguage } from "@/services/OCRService";

interface ScannedNoteViewProps {
  className?: string;
  imageData?: string;
  pageId?: string;
  readOnly?: boolean;
  note?: any; // Support the legacy note prop until NotePage is updated
}

const ScannedNoteView: React.FC<ScannedNoteViewProps> = ({ 
  className, 
  imageData, 
  pageId, 
  readOnly = false,
  note
}) => {
  // Handle both direct props and legacy note prop
  const effectiveImageData = imageData || (note?.imageData || note?.content?.imageData);
  const effectivePageId = pageId || note?.id;
  
  const { currentPage, performOCR, updateOCRText } = useNotebook();
  const [showOcrPanel, setShowOcrPanel] = useState(false);
  const [ocrText, setOcrText] = useState(
    currentPage?.ocrText || note?.ocrText || note?.content?.ocrText || ""
  );
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [language, setLanguage] = useState<OCRLanguage>(
    (currentPage?.ocrLanguage || note?.ocrLanguage || 'eng') as OCRLanguage
  );
  
  // Get supported languages
  const languages = OCRService.getSupportedLanguages();
  
  const handleRunOCR = async () => {
    if (!effectivePageId) return;
    
    setIsProcessing(true);
    try {
      const text = await performOCR(effectivePageId, language);
      setOcrText(text);
      setShowOcrPanel(true);
      setIsEditing(false);
    } catch (error) {
      console.error("OCR error:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleSaveText = async () => {
    if (!effectivePageId) return;
    
    setIsProcessing(true);
    try {
      await updateOCRText(effectivePageId, ocrText, language);
      setIsEditing(false);
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  if (!effectiveImageData) {
    return <div className={className}>No image data available</div>;
  }
  
  return (
    <div className="space-y-4">
      <Card className={`overflow-hidden ${className || ""}`}>
        <CardContent className="p-0">
          <img 
            src={effectiveImageData} 
            alt="Scanned Note" 
            className="w-full h-auto object-contain"
          />
        </CardContent>
      </Card>
      
      {!readOnly && (
        <>
          <div className="flex flex-wrap gap-2 justify-end">
            <Select 
              value={language}
              onValueChange={(val) => setLanguage(val as OCRLanguage)}
            >
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map(lang => (
                  <SelectItem key={lang.id} value={lang.id}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              onClick={showOcrPanel ? () => setShowOcrPanel(false) : handleRunOCR}
              disabled={isProcessing}
              variant={showOcrPanel ? "outline" : "default"}
              className="flex items-center gap-2"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4" />
                  {showOcrPanel ? "Hide Text" : "Convert to Text"}
                </>
              )}
            </Button>
          </div>
          
          {showOcrPanel && (
            <Card className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-medium">Recognized Text</h3>
                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => {
                          setIsEditing(false);
                          setOcrText(currentPage?.ocrText || note?.ocrText || "");
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button 
                        variant="default" 
                        size="sm" 
                        onClick={handleSaveText}
                        disabled={isProcessing}
                      >
                        {isProcessing ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-1" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Save
                      </Button>
                    </>
                  ) : (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
              
              {isEditing ? (
                <Textarea
                  value={ocrText}
                  onChange={(e) => setOcrText(e.target.value)}
                  className="min-h-[200px]"
                  placeholder="OCR text will appear here"
                />
              ) : (
                <div className="border rounded-md p-3 min-h-[200px] bg-gray-50 dark:bg-gray-800">
                  {ocrText ? (
                    <p className="whitespace-pre-wrap">{ocrText}</p>
                  ) : (
                    <p className="text-gray-400 italic">
                      No text has been recognized yet. Click "Convert to Text" to process this image.
                    </p>
                  )}
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
};

export default ScannedNoteView;
