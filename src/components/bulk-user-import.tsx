"use client"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { 
  Loader2, 
  Upload, 
  CheckCircle2, 
  AlertCircle,
  Download,
  FileSpreadsheet,
  Copy,
  FileDown,
  Eye,
  EyeOff,
  Check,
  RefreshCw
} from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"

interface BulkImportResult {
  success: number
  failed: number
  errors: Array<{
    row: number
    email: string
    error: string
  }>
  users: Array<{
    email: string
    password: string
    name: string
    uid: string
    siteName?: string
    teamName?: string
  }>
}

interface BulkUpdateResult {
  updated: number
  failed: number
  errors: Array<{
    row: number
    email: string
    error: string
  }>
  updatedUsers: Array<{
    email: string
    name: string
    updatedFields: string[]
  }>
}

interface BulkUserImportProps {
  onSuccess?: () => void
}

export default function BulkUserImport({ onSuccess }: BulkUserImportProps) {
  const [activeTab, setActiveTab] = useState<"import" | "update">("import")
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null)
  const [updateResult, setUpdateResult] = useState<BulkUpdateResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPasswords, setShowPasswords] = useState(true)
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)
  const [credentialsSaved, setCredentialsSaved] = useState(false)
  const importFileInputRef = useRef<HTMLInputElement>(null)
  const updateFileInputRef = useRef<HTMLInputElement>(null)

  const downloadImportTemplate = () => {
    const csvContent = `name,email,college,siteName,teamName,hostelName,roomNumber,wifiusername,wifiPassword,hostelLocation,contactNumber,gender
John Doe,john@example.com,MIT,Amritapuri,Team Alpha,Hostel A,101,wifi_john,pass123,https://maps.google.com,1234567890,male
Jane Smith,jane@example.com,Stanford,Amritapuri,Team Beta,Hostel B,202,wifi_jane,pass456,https://maps.google.com,0987654321,female
Bob Johnson,bob@example.com,Harvard,Coimbatore,Team Gamma,Hostel C,303,wifi_bob,pass789,https://maps.google.com,1122334455,male`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'user_import_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const downloadUpdateTemplate = () => {
    const csvContent = `name,email,college,siteName,teamName,hostelName,roomNumber,wifiusername,wifiPassword,hostelLocation,contactNumber,gender
John Doe,john@example.com,MIT,Amritapuri,Team Alpha Updated,Hostel A,101,wifi_john,pass123,https://maps.google.com,1234567890,male
Jane Smith,jane@example.com,Stanford,Amritapuri,Team Beta,Hostel B New,202,wifi_jane_new,pass456new,https://maps.google.com/newlocation,0987654321,female`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'user_update_template.csv'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
  }

  const downloadPasswordsCSV = () => {
    if (!importResult?.users || importResult.users.length === 0) return

    const csvContent = `Name,Email,UID,Site Name,Team Name,Password,Login URL\n${importResult.users.map(u => 
      `"${u.name}","${u.email}","${u.uid}","${u.siteName || 'N/A'}","${u.teamName || 'N/A'}","${u.password}","${window.location.origin}/login"`
    ).join('\n')}`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `user_credentials_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)
    
    setCredentialsSaved(true)
  }

  const copyPassword = (password: string, index: number) => {
    navigator.clipboard.writeText(password)
    setCopiedIndex(index)
    setTimeout(() => setCopiedIndex(null), 2000)
  }

  const copyAllCredentials = () => {
    if (!importResult?.users) return

    const text = importResult.users.map(u => 
      `Name: ${u.name}\nEmail: ${u.email}\nUID: ${u.uid}\nSite: ${u.siteName || 'N/A'}\nTeam: ${u.teamName || 'N/A'}\nPassword: ${u.password}\nLogin: ${window.location.origin}/login\n`
    ).join('\n---\n\n')

    navigator.clipboard.writeText(text)
    setCredentialsSaved(true)
  }

  const printCredentials = () => {
    if (!importResult?.users) return

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>User Credentials - ${new Date().toLocaleDateString()}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { color: #333; border-bottom: 2px solid #333; padding-bottom: 10px; }
          .credential-card { 
            border: 1px solid #ddd; 
            padding: 15px; 
            margin: 15px 0; 
            border-radius: 8px;
            page-break-inside: avoid;
          }
          .label { font-weight: bold; color: #666; }
          .value { color: #333; margin-left: 10px; }
          .password { 
            font-family: monospace; 
            background: #f5f5f5; 
            padding: 5px 10px; 
            border-radius: 4px;
            font-size: 14px;
          }
          .uid {
            font-family: monospace;
            background: #e3f2fd;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
          }
          .warning {
            background: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 8px;
          }
          @media print {
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <h1>User Credentials - Generated on ${new Date().toLocaleString()}</h1>
        <div class="warning">
          <strong>⚠️ IMPORTANT:</strong> These credentials are shown only once. Keep this document secure and share individually with users.
        </div>
        ${importResult.users.map((u, i) => `
          <div class="credential-card">
            <h3>User ${i + 1}</h3>
            <p><span class="label">Name:</span><span class="value">${u.name}</span></p>
            <p><span class="label">Email:</span><span class="value">${u.email}</span></p>
            <p><span class="label">UID:</span><span class="value uid">${u.uid}</span></p>
            <p><span class="label">Site Name:</span><span class="value">${u.siteName || 'N/A'}</span></p>
            <p><span class="label">Team Name:</span><span class="value">${u.teamName || 'N/A'}</span></p>
            <p><span class="label">Password:</span><span class="value password">${u.password}</span></p>
            <p><span class="label">Login URL:</span><span class="value">${window.location.origin}/login</span></p>
          </div>
        `).join('')}
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `

    printWindow.document.write(html)
    printWindow.document.close()
    setCredentialsSaved(true)
  }

  const handleFinish = () => {
    if (activeTab === "import" && !credentialsSaved && importResult?.users && importResult.users.length > 0) {
      const confirmed = confirm(
        "⚠️ WARNING: You haven't downloaded or printed the credentials yet!\n\n" +
        "These passwords cannot be recovered once you close this dialog.\n\n" +
        "Are you sure you want to continue without saving?"
      )
      if (!confirmed) return
    }

    setImportResult(null)
    setUpdateResult(null)
    setCredentialsSaved(false)
    setError(null)
    if (onSuccess) {
      onSuccess()
    }
  }

  const resetState = () => {
    setImportResult(null)
    setUpdateResult(null)
    setError(null)
    setCredentialsSaved(false)
    setUploadProgress(0)
    if (importFileInputRef.current) {
      importFileInputRef.current.value = ''
    }
    if (updateFileInputRef.current) {
      updateFileInputRef.current.value = ''
    }
  }

  const handleImportFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    setIsUploading(true)
    setError(null)
    setImportResult(null)
    setUploadProgress(0)
    setCredentialsSaved(false)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/users/bulk-import', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      const data = await response.json()

      if (response.ok) {
        setImportResult(data)
        setUploadProgress(100)
      } else {
        setError(data.error || 'Failed to import users')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      setError('An error occurred while uploading the file')
    } finally {
      setIsUploading(false)
      if (importFileInputRef.current) {
        importFileInputRef.current.value = ''
      }
    }
  }

  const handleUpdateFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.csv')) {
      setError('Please upload a CSV file')
      return
    }

    setIsUploading(true)
    setError(null)
    setUpdateResult(null)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      const response = await fetch('/api/users/bulk-update', {
        method: 'POST',
        body: formData,
      })

      clearInterval(progressInterval)
      const data = await response.json()

      if (response.ok) {
        setUpdateResult(data)
        setUploadProgress(100)
      } else {
        setError(data.error || 'Failed to update users')
      }
    } catch (error) {
      console.error('Error uploading file:', error)
      setError('An error occurred while uploading the file')
    } finally {
      setIsUploading(false)
      if (updateFileInputRef.current) {
        updateFileInputRef.current.value = ''
      }
    }
  }

  const handleTabChange = (value: string) => {
    if (activeTab === "import" && importResult?.users && importResult.users.length > 0 && !credentialsSaved) {
      const confirmed = confirm(
        "⚠️ WARNING: You haven't saved the credentials yet!\n\n" +
        "Switching tabs will clear the current results. Are you sure?"
      )
      if (!confirmed) return
    }
    resetState()
    setActiveTab(value as "import" | "update")
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="import" className="gap-2">
            <Upload className="h-4 w-4" />
            Create New Users
          </TabsTrigger>
          <TabsTrigger value="update" className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Update Existing Users
          </TabsTrigger>
        </TabsList>

        {/* IMPORT TAB */}
        <TabsContent value="import" className="space-y-6 mt-6">
          {/* Instructions */}
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Create New Users:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li><strong>Required:</strong> name, email, college</li>
                  <li><strong>Optional:</strong> siteName, teamName, hostel details</li>
                  <li><strong>Random secure passwords</strong> generated automatically</li>
                  <li><strong>Download credentials</strong> before closing this dialog</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Download Template Button */}
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={downloadImportTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Sample CSV
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="import-csv-file" className="text-base font-medium">
              Upload CSV File
            </Label>
            <Input
              ref={importFileInputRef}
              id="import-csv-file"
              type="file"
              accept=".csv"
              onChange={handleImportFileChange}
              disabled={isUploading || (importResult !== null)}
              className="cursor-pointer"
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Importing users...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Import Success Result */}
          {importResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium">Successfully Created</div>
                    <div className="text-2xl  mt-1">{importResult.success}</div>
                  </AlertDescription>
                </Alert>

                {importResult.failed > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium">Failed</div>
                      <div className="text-2xl  mt-1">{importResult.failed}</div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Generated Passwords */}
              {importResult.users.length > 0 && (
                <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <p className=" text-amber-900 dark:text-amber-100 text-lg">
                          ⚠️ IMPORTANT: Save These Credentials Now!
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Passwords are generated randomly and <strong>cannot be recovered</strong>. 
                          Download or print these credentials before clicking "Finish".
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          onClick={downloadPasswordsCSV}
                          className="gap-2"
                          variant={credentialsSaved ? "outline" : "default"}
                        >
                          <FileDown className="h-4 w-4" />
                          {credentialsSaved ? "Downloaded ✓" : "Download CSV"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={printCredentials}
                          className="gap-2"
                        >
                          <Download className="h-4 w-4" />
                          Print Credentials
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={copyAllCredentials}
                          className="gap-2"
                        >
                          <Copy className="h-4 w-4" />
                          Copy All
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShowPasswords(!showPasswords)}
                          className="gap-2 ml-auto"
                        >
                          {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          {showPasswords ? 'Hide' : 'Show'} Passwords
                        </Button>
                      </div>
                      
                      {/* Credentials Table */}
                      <ScrollArea className="h-96 rounded-md border bg-white dark:bg-gray-900">
                        <Table>
                          <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                            <TableRow>
                              <TableHead className="w-[50px]">#</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>UID</TableHead>
                              <TableHead>Site</TableHead>
                              <TableHead>Team</TableHead>
                              <TableHead>Password</TableHead>
                              <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {importResult.users.map((user, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium text-gray-500">
                                  {index + 1}
                                </TableCell>
                                <TableCell className="font-medium">{user.name}</TableCell>
                                <TableCell className="text-sm">{user.email}</TableCell>
                                <TableCell className="font-mono text-sm  text-blue-600">
                                  {user.uid}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {user.siteName || <span className="text-muted-foreground">-</span>}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {user.teamName || <span className="text-muted-foreground">-</span>}
                                </TableCell>
                                <TableCell className="font-mono text-sm">
                                  {showPasswords ? user.password : '••••••••••••'}
                                </TableCell>
                                <TableCell>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => copyPassword(user.password, index)}
                                    className="h-8 w-8 p-0"
                                    title="Copy password"
                                  >
                                    {copiedIndex === index ? (
                                      <Check className="h-3 w-3 text-green-600" />
                                    ) : (
                                      <Copy className="h-3 w-3" />
                                    )}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>

                      {/* Sharing Instructions */}
                      <div className="text-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-3">
                        <p className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                          📧 How to share credentials with users:
                        </p>
                        <ol className="list-decimal list-inside space-y-1 text-blue-800 dark:text-blue-200">
                          <li>Download the CSV file or print the credentials</li>
                          <li>Send credentials individually via email or secure channel</li>
                          <li>Advise users to change their password after first login</li>
                          <li>Login URL: <code className="bg-blue-100 dark:bg-blue-900 px-2 py-0.5 rounded">{window.location.origin}/login</code></li>
                        </ol>
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Details */}
              {importResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">Import Errors:</div>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {importResult.errors.map((err, index) => (
                          <div key={index} className="text-sm border-l-2 border-red-500 pl-2">
                            <div className="font-medium">Row {err.row}: {err.email}</div>
                            <div className="text-red-600 dark:text-red-400">{err.error}</div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              {/* Finish Button */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  onClick={handleFinish}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finish & Close
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* UPDATE TAB */}
        <TabsContent value="update" className="space-y-6 mt-6">
          {/* Instructions */}
          <Alert>
            <RefreshCw className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Update Existing Users:</p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  <li><strong>Verification Fields:</strong> name, email, college, siteName (must match existing user)</li>
                  <li><strong>Updatable Fields:</strong> teamName, hostelName, roomNumber, wifiusername, wifiPassword, hostelLocation, contactNumber, gender</li>
                  <li>Users are verified by matching name, email, college, and siteName before updating</li>
                  <li>Only non-empty fields in the CSV will be updated</li>
                </ul>
              </div>
            </AlertDescription>
          </Alert>

          {/* Download Template Button */}
          <div className="flex items-center gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={downloadUpdateTemplate}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              Download Update Template CSV
            </Button>
          </div>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="update-csv-file" className="text-base font-medium">
              Upload CSV File for Update
            </Label>
            <Input
              ref={updateFileInputRef}
              id="update-csv-file"
              type="file"
              accept=".csv"
              onChange={handleUpdateFileChange}
              disabled={isUploading || (updateResult !== null)}
              className="cursor-pointer"
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Updating users...</span>
                <span className="font-medium">{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}

          {/* Error Message */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Update Success Result */}
          {updateResult && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <Alert className="bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium">Successfully Updated</div>
                    <div className="text-2xl  mt-1">{updateResult.updated}</div>
                  </AlertDescription>
                </Alert>

                {updateResult.failed > 0 && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="font-medium">Failed</div>
                      <div className="text-2xl  mt-1">{updateResult.failed}</div>
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Updated Users Table */}
              {updateResult.updatedUsers.length > 0 && (
                <Alert className="bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <AlertDescription>
                    <div className="space-y-3">
                      <p className=" text-green-900 dark:text-green-100">
                        Successfully Updated Users:
                      </p>
                      
                      <ScrollArea className="h-64 rounded-md border bg-white dark:bg-gray-900">
                        <Table>
                          <TableHeader className="sticky top-0 bg-gray-50 dark:bg-gray-800">
                            <TableRow>
                              <TableHead className="w-[50px]">#</TableHead>
                              <TableHead>Name</TableHead>
                              <TableHead>Email</TableHead>
                              <TableHead>Updated Fields</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {updateResult.updatedUsers.map((user, index) => (
                              <TableRow key={index}>
                                <TableCell className="font-medium text-gray-500">
                                  {index + 1}
                                </TableCell>
                                <TableCell className="font-medium">{user.name}</TableCell>
                                <TableCell className="text-sm">{user.email}</TableCell>
                                <TableCell>
                                  <div className="flex flex-wrap gap-1">
                                    {user.updatedFields.map((field, i) => (
                                      <span
                                        key={i}
                                        className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                      >
                                        {field}
                                      </span>
                                    ))}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {/* Error Details */}
              {updateResult.errors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="font-medium mb-2">Update Errors:</div>
                    <ScrollArea className="h-64">
                      <div className="space-y-2">
                        {updateResult.errors.map((err, index) => (
                          <div key={index} className="text-sm border-l-2 border-red-500 pl-2">
                            <div className="font-medium">Row {err.row}: {err.email}</div>
                            <div className="text-red-600 dark:text-red-400">{err.error}</div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </AlertDescription>
                </Alert>
              )}

              {/* Finish Button */}
              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={resetState}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Update More
                </Button>
                <Button
                  onClick={handleFinish}
                  className="gap-2"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Finish & Close
                </Button>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}