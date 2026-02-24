import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload,
  File,
  CheckCircle,
  AlertCircle,
  X,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { processBanplusFile, processBancamigaFile } from "@/utils/process-xls";
import { Payment, PaymentBank } from "@/types/payments";
import { approvePayment, getPaymentsByBank } from "@/actions/API/payments";
import { getMatchPaymentsLast6 } from "@/utils/matchPayment";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

interface UploadedFile {
  name: string;
  size: number;
  uploadedAt: Date;
  rows?: number;
}

interface CsvUploadProps {
  onClose?: () => void;
  onSuccess?: (file: UploadedFile) => void;
}

export default function FileInput({ onClose, onSuccess }: CsvUploadProps) {
  const [payments, setPayments] = useState<PaymentBank[]>([]);
  const [apiPayments, setApiPayments] = useState<Payment[]>([]);
  const [bank, setBank] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const sendPaymentApprove = async (
    id: string,
    data: {
      client_id: string;
      amount: string;
      payment_date: string;
      transaction_code: string;
    },
  ) => {
    setLoading(true);
    const result = await approvePayment(id, data);
    console.log(result);
    if (result.data) {
      setLoading(false);
      router.refresh();
    }
  };

  const processPayments = async () => {
    if (payments?.length > 0 && apiPayments) {
      setLoading(true);
      const match = getMatchPaymentsLast6(apiPayments, payments);
      console.log(match);
      for (const payment of match) {
        await approvePayment(payment.id, {
          client_id: payment.client_id,
          amount: payment.amount,
          payment_date: payment.payment_date,
          transaction_code: payment.transaction_code,
        });
      }
      setLoading(false);
    }
  };

  const handleBank = async (bank: string) => {
    const apiPayments = await getPaymentsByBank(bank);
    let fileProcessed: PaymentBank[];
    if (file && bank === "Banplus") {
      fileProcessed = await processBanplusFile(file);
      setPayments(fileProcessed);
      setApiPayments(apiPayments);
    }
    if (file && bank === "Bancamiga") {
      fileProcessed = await processBancamigaFile(file);
      setPayments(fileProcessed);
      setApiPayments(apiPayments);
    }
  };

  const validateFile = (file: File): string | null => {
    const validExtensions = [".csv", ".xls", ".xlsx"];
    const hasValidExtension = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext),
    );

    if (!hasValidExtension) {
      return "Por favor, selecciona un archivo CSV, XLS o XLSX válido";
    }
    if (file.size > 10 * 1024 * 1024) {
      return "El archivo no debe superar 10MB";
    }
    return null;
  };

  const processFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      setFile(file);
      const fileData = {
        name: file.name,
        size: file.size,
        uploadedAt: new Date(),
      };
      setUploadedFile(fileData);

      if (onSuccess) {
        onSuccess(fileData);
      }
    } catch (err) {
      setError("Error al procesar el archivo");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isProcessButtonDisabled =
    !uploadedFile || !payments || apiPayments.length === 0;

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      {!onClose && (
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-foreground">
            Importa tu archivo CSV
          </h1>
          <p className="text-muted-foreground">
            Carga tu archivo CSV para procesarlo y visualizar los datos
          </p>
        </div>
      )}

      {/* Upload Area */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`relative border-2 border-dashed rounded-2xl p-8 transition-all duration-300 ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.02]"
            : "border-border bg-secondary/20 hover:border-primary/50 hover:bg-secondary/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.xls,.xlsx"
          onChange={handleFileSelect}
          className="hidden"
          aria-label="Seleccionar archivo CSV, XLS o XLSX"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div
            className={`p-4 rounded-full transition-colors duration-300 ${
              isDragging
                ? "bg-primary/20 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            <Upload size={32} />
          </div>

          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-foreground">
              {isDragging
                ? "Suelta tu archivo aquí"
                : "Arrastra tu archivo CSV, XLS o XLSX aquí"}
            </p>
            <p className="text-sm text-muted-foreground">
              o haz clic para seleccionar
            </p>
          </div>

          <Button
            onClick={handleClick}
            disabled={isLoading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2"
          >
            {isLoading ? "Procesando..." : "Seleccionar archivo"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Máximo 10MB • Formatos: CSV, XLS, XLSX
          </p>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-destructive text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Bank Selection */}
      {uploadedFile && !error && (
        <div className="p-4 rounded-xl border border-border bg-card">
          <label className="block text-sm font-semibold text-foreground mb-3">
            Selecciona el banco
          </label>
          <Select
            value={bank}
            onValueChange={async (e) => {
              setBank(e);
              await handleBank(e);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elige un banco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Banplus">Banplus</SelectItem>
              <SelectItem value="Bancamiga">Bancamiga</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Success State with Preview */}
      {uploadedFile && !error && (
        <div className="space-y-4">
          {isLoading && (
            <div>
              <Spinner />
            </div>
          )}
          {/* File Info Card */}
          <div className="p-4 rounded-xl border border-border bg-card space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className="p-2.5 rounded-lg bg-primary/10">
                  <FileText className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">
                    {uploadedFile.name}
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-sm text-muted-foreground">
                    <span>{formatFileSize(uploadedFile.size)}</span>
                    {uploadedFile.rows && (
                      <span>{uploadedFile.rows} filas</span>
                    )}
                    <span>
                      {uploadedFile.uploadedAt.toLocaleTimeString("es-ES", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {/* Success indicator */}
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Archivo cargado exitosamente
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleClick}
              variant="outline"
              className="flex-1 bg-transparent"
            >
              Cambiar archivo
            </Button>
            <Button
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={processPayments}
              disabled={isProcessButtonDisabled}
            >
              Procesar datos
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
