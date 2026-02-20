"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import FileInput from "./FileInput";

interface UploadedFile {
  name: string;
  size: number;
  uploadedAt: Date;
  rows?: number;
}

export default function FileInputModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [uploadedData, setUploadedData] = useState<{
    file: UploadedFile;
    preview: string[][];
  } | null>(null);

  const handleClose = () => {
    setTimeout(() => {
      setIsOpen(false);
      setUploadedData(null);
    }, 500);
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
      >
        <Upload size={20} />
        Importar CSV
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              Importa tu archivo CSV
            </DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <FileInput onClose={handleClose} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
