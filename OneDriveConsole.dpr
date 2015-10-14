program OneDriveConsole;

{$APPTYPE CONSOLE}
{$R *.res}
{$WARN DUPLICATE_CTOR_DTOR OFF}

uses
  System.SysUtils,
  Windows,
  IniFiles,
  SBDataStorage,
  SBSimpleSSL,
  SBHTTPSClient,
  SBX509,
  SBOneDriveDataStorage,
  SBSSLCommon,
  SBSocket,
  SBConstants,
  SBTypes,
  SBUtils,
  SBStrUtils,
  Classes,
  System.StrUtils,
  System.Types,
  SBEncoding,
  SBAS2,
  SBHTTPSConstants,
  SBSSLConstants,
  GpCommandLineParser,
  stopwatch,
  LoginForm in 'LoginForm.pas' {frmLogin} ,
  StartForm in 'StartForm.pas' {frmStart};

type
  TEvents = class
  public
    procedure TransportCertificateValidate(Sender: TObject; X509Certificate: TElX509Certificate; var Validate: Boolean);
    procedure DataStorageProgress(Sender: TObject; Operation: TSBDataStorageOperation; Total, Current: Int64;
      var Cancel: Boolean);
  end;

  TCommandLine = class
  strict private
    FSourceFile: string;
    FDestFile: string;
    FNorecurse: Boolean;
    FOverwrite: Boolean;
    FMulti: Boolean;
    FSingle: Boolean;
    FWait: Boolean;
    FQBT: Boolean;
    FMaxSize: Int64;
    FMaxCount: Int64;

    FSendBuffer: Integer;
  public
    [CLPPosition(1), CLPRequired, CLPDescription('Source file/directory/file mask')]
    property Source: string read FSourceFile write FSourceFile;

    [CLPPosition(2), CLPRequired, CLPDescription('OneDrive destination folder')]
    property Destination: string read FDestFile write FDestFile;

    [CLPDescription('Don''t recurse directories'), CLPName('n'), CLPLongName('norecurse')]
    property PRecurse: Boolean read FNorecurse write FNorecurse;

    [CLPDescription('Overwrite existing files on Onedrive'), CLPName('o'), CLPLongName('overwrite')]
    property POverwrite: Boolean read FOverwrite write FOverwrite;

    [CLPDescription('Multi-file torrent (skip filename part)'), CLPLongName('multi')]
    property PMulti: Boolean read FMulti write FMulti;

    [CLPDescription('Single-file torrent (don''t skip filename part)'), CLPLongName('single')]
    property PSingle: Boolean read FSingle write FSingle;

    [CLPDescription('qBittorent mode'), CLPLongName('qbittorent')]
    property PQBT: Boolean read FQBT write FQBT;

    [CLPDescription('Wait on finish'), CLPName('w'), CLPLongName('wait')]
    property PWait: Boolean read FWait write FWait;
    // 4194304
    [CLPDefault('512000'), CLPLongName('sendbuffer'), CLPDescription('Send buffer size')]
    property PSendBuffer: Integer read FSendBuffer write FSendBuffer;

    [CLPDefault('0'), CLPLongName('maxsize'), CLPName('s'),
      CLPDescription('Don''t upload if total size exceeds this limit (in bytes)')]
    property RMaxSize: Int64 read FMaxSize write FMaxSize;

    [CLPDefault('0'), CLPLongName('maxfilecount'), CLPName('c'),
      CLPDescription('Don''t upload if file count exceeds this limit')]
    property RMaxCount: Int64 read FMaxCount write FMaxCount;
  end;

const
  SectionSettings = 'OneDrive';
  ValueClientID = 'ClientID';
  ValueClientSecret = 'ClientSecret';
  ValueRefreshToken = 'RefreshToken';

var
  OneDrive: TElOneDriveDataStorage;
  Transport: TElHTTPSClient;
  Event: TEvents;
  Cached: TStringList;
  speed: Cardinal;
  remain: string;
  swprogress: TStopWatch;
  prevcount: Int64;

function FormatByteSize(const bytes: Int64): string;
var
  B: Int64;
  KB: Int64;
  MB: Int64;
  GB: Int64;
  TB: Int64;
begin

  B := 1; // byte
  KB := 1024 * B; // kilobyte
  MB := 1000 * KB; // megabyte
  GB := 1000 * MB; // gigabyte
  TB := 1000 * GB; // teraabyte

  if bytes > TB then
    result := FormatFloat('#.##tb', bytes / TB)
  else if bytes > GB then
    result := FormatFloat('#.##gb', bytes / GB)
  else if bytes > MB then
    result := FormatFloat('#.##mb', bytes / MB)
  else if bytes > KB then
    result := FormatFloat('#.##kb', bytes / KB)
  else if bytes > 0 then
    result := FormatFloat('#.## bytes', bytes)
  else
    result := '0';

end;

function GetSettingsFileName(): string;

begin
  result := ChangeFileExt(ParamStr(0), '.ini');
end;

procedure LoadSettings();
var
  Ini: TIniFile;
  FileName: string;

begin
  FileName := GetSettingsFileName();

  if FileExists(FileName) then
  begin
    Ini := TIniFile.Create(FileName);
    try
      OneDrive.ClientID := Ini.ReadString(SectionSettings, ValueClientID, '');
      OneDrive.ClientSecret := Ini.ReadString(SectionSettings, ValueClientSecret, '');
      OneDrive.RefreshToken := Ini.ReadString(SectionSettings, ValueRefreshToken, '');
    finally
      FreeAndNil(Ini);
    end;
  end;
end;

procedure SaveSettings();
var
  Ini: TIniFile;
  FileName: string;
begin
  FileName := GetSettingsFileName();
  try
    Ini := TIniFile.Create(FileName);
    try
      Ini.WriteString(SectionSettings, ValueClientID, OneDrive.ClientID);
      Ini.WriteString(SectionSettings, ValueClientSecret, OneDrive.ClientSecret);
      Ini.WriteString(SectionSettings, ValueRefreshToken, OneDrive.RefreshToken);
    finally
      FreeAndNil(Ini);
    end;
  except
  end;
end;

procedure TEvents.TransportCertificateValidate(Sender: TObject; X509Certificate: TElX509Certificate;
  var Validate: Boolean);

begin
  // this is for demo only; do not do this in real programs!!!
  Validate := True;
end;

procedure TEvents.DataStorageProgress(Sender: TObject; Operation: TSBDataStorageOperation; Total, Current: Int64;
  var Cancel: Boolean);
var
  i: Integer;
begin
  if Total < OneDrive.ChunkedUploadChunkSize then
    exit;

  { TODO same line progress #8 }
  if Total <> 0 then
  begin
    for i := 0 to 80 do
      write(#$8);
    swprogress.Stop;
    if ((Current - prevcount) div swprogress.elapsedMilliseconds) > 2 then
    begin
      speed := (Current - prevcount) div swprogress.elapsedMilliseconds;
      remain := FormatDateTime('hh:nn:ss', (((Total - Current) / 1000) / speed) / SecsPerDay) + ' remaining';
    end;
    prevcount := Current;
    swprogress.Start;
    Write(inttostr(round((Current / Total) * 100)) + '% - ' + speed.ToString + 'kb/s - ' + FormatByteSize(Current) + '/'
      + FormatByteSize(Total) + ' - ' + remain + '           ');
  end;
  //
end;

procedure LoadQuotaInfo();

var
  TotalBytes, FreeBytes: Int64;

begin
  try
    OneDrive.GetQuota(TotalBytes, FreeBytes);
  except
    on E: Exception do
    begin
      Writeln('Failed to get quota information.'#13#10'Reason: ' + E.Message);
      exit;
    end;
  end;

  // because ProgressBar does not accept Int64 values,
  // the values are divided by 1024 and are shown in KB
  Writeln(FormatFloat(',0', TotalBytes / (1024 * 1024 * 1024)) + ' Gb / ' + FormatFloat(',0',
    FreeBytes / (1024 * 1024 * 1024)) + ' Gb');
end;

procedure ConnectExecute();

var
  URL, Code: string;
  ClientID, ClientSecret: string;

begin
  try
    URL := OneDrive.StartAuthorization();

    if URL <> '' then
    begin
      Writeln('Authorization required');
      ClientID := OneDrive.ClientID;
      ClientSecret := OneDrive.ClientSecret;

      if not TfrmStart.Execute(ClientID, ClientSecret) then
        exit;

      if (OneDrive.RefreshToken = '') or ((ClientID <> OneDrive.ClientID) or (ClientSecret <> OneDrive.ClientSecret))
      then
      begin
        OneDrive.CloseSession();
        OneDrive.ClientID := ClientID;
        OneDrive.ClientSecret := ClientSecret;
        OneDrive.RefreshToken := '';
        URL := OneDrive.StartAuthorization();
        SaveSettings();
      end;

      TfrmLogin.Execute(URL, Code);

      OneDrive.CompleteAuthorization(Code);

      SaveSettings();
    end;
  except
    on ECancelAuthorization do
    begin
      // this exception is raised in the TfrmLogin.Execute method
      // if the user cancels authorization process in the login dialog;
      // so it's needed to close the http session and ignore the exception
      OneDrive.CloseSession();
      exit;
    end;
    on Exception do
    begin
      OneDrive.CloseSession();
      raise;
    end;
  end;
  Writeln('Logged in to OneDrive');
end;

function GetODObjByID(path: string; id: string): TElOneDriveDataStorageObject;
var
  o: TElOneDriveDataStorageObject;
  i: Integer;
begin
  o := nil;
  for i := 0 to Cached.Count - 1 do
  begin
    if TElOneDriveDataStorageObject(Cached.Objects[i]).id = id then
    begin
      o := TElOneDriveDataStorageObject(Cached.Objects[i]);
      break;
    end;
  end;
  if o = nil then
  begin
    o := TElOneDriveDataStorageObject(OneDrive.AcquireObject(id));
    Cached.AddObject(path, o.Clone);
  end;
  result := o;
end;

function GetODObjByIDOnly(id: string): TElOneDriveDataStorageObject;
var
  o: TElOneDriveDataStorageObject;
  i: Integer;
begin
  o := nil;
  for i := 0 to Cached.Count - 1 do
  begin
    if TElOneDriveDataStorageObject(Cached.Objects[i]).id = id then
    begin
      o := TElOneDriveDataStorageObject(Cached.Objects[i]);
      break;
    end;
  end;
  if o = nil then
  begin
    o := TElOneDriveDataStorageObject(OneDrive.AcquireObject(id));
  end;
  result := o;
end;

function ODFileExists(fn: string): Boolean;
var
  i: Integer;
begin
  result := false;
  for i := 0 to Cached.Count - 1 do
  begin
    // Writeln(Cached[i]+' / ' +fn);
    if uppercase(Cached[i]) = uppercase(fn) then
    begin
      result := True;
      break;
    end;
  end;
end;

procedure CacheAdd(path: string; o: TElOneDriveDataStorageObject);
var
  i: Integer;
begin
  for i := 0 to Cached.Count - 1 do
  begin
    if TElOneDriveDataStorageObject(Cached.Objects[i]).id = o.id then
      exit;
  end;
  Cached.AddObject(path, o.Clone);
end;

function GetFolderID(s: string; CreateifNotExists: Boolean = True): string;

var
  mi: Integer;
  // mObj: TElOneDriveDataStorageObject;
  mPath: TStringDynArray;
  sPath: TStrings;
  sSanitized: string;

  function GetIDRecurse(id: string; path: TStrings; PathTillNow: string; level: Integer): string;

  var
    Content: TElDataStorageObjectList;
    i: Integer;
    ObjCurrent, obj: TElOneDriveDataStorageObject;
    ddir: TElOneDriveFolder;

  begin
    result := '';
    Content := TElDataStorageObjectList.Create();
    if level = 0 then
    begin
      if path.Count = 0 then // root only
      begin
        result := 'root';
        exit;
      end;
      OneDrive.ListFriendly('', Content); // list root
      ObjCurrent := GetODObjByID(PathTillNow, '');
    end
    else
    begin
      try
        ObjCurrent := GetODObjByID(PathTillNow, id);
      except // directory not exists
        on E: Exception do
        begin
          Writeln(E.Message);
          exit;
        end;
      end;
      TElOneDriveFolder(ObjCurrent).List(Content);
    end;

    for i := 0 to Content.Count - 1 do
    begin
      obj := TElOneDriveDataStorageObject(Content[i]);
      CacheAdd(PathTillNow + '/' + obj.Name, obj);
      if obj.ObjectType = 'file' then
        Continue;

      if (level <> -1) then
        if AnsiUpperCase(obj.Name) = AnsiUpperCase(path[level]) then
        begin
          if level < path.Count - 1 then
            result := GetIDRecurse(obj.id, path, PathTillNow + '/' + path[level], level + 1)
          else
          begin
            result := obj.id;
            // if path.Count > 1 then
            GetIDRecurse(obj.id, path, PathTillNow + '/' + obj.Name, -1);
            // level -1 / caching only
          end;
        end;
    end;

    if (result = '') and CreateifNotExists and (level <> -1) then
    // dir not found
    begin // create dir
      try
        ddir := OneDrive.CreateFolder(TElOneDriveFolder(ObjCurrent), path[level], '');
        Writeln('Created folder ' + path[level] + ' in ' + PathTillNow);
        if level < path.Count - 1 then
          result := GetIDRecurse(ddir.id, path, PathTillNow + '/' + path[level], level + 1)
        else
        begin
          result := ddir.id;
          // if path.Count > 1 then
          // GetIDRecurse(obj.id, path, PathTillNow + '/' + obj.Name, -1); // level -1 / caching only
        end;

        // if level < path.Count - 1 then
        // result := GetIDRecurse(ddir.id, path, PathTillNow + '/' + path[level], level + 1)
        // else
        // result := ddir.id;
        FreeAndNil(ddir);
      except
        on E: Exception do
        begin
          Writeln(E.Message);
          exit;
        end;

      end;

    end;

    FreeAndNil(Content);
  end;

begin
  sSanitized := Trim(StringReplace(s, '\', '/', [rfReplaceAll]));
  if sSanitized.EndsWith('/') then
    sSanitized := sSanitized.Remove(sSanitized.Length - 1);

  for mi := 0 to Cached.Count - 1 do
    if uppercase(sSanitized) = uppercase(Cached[mi]) then
    begin
      result := TElOneDriveDataStorageObject(Cached.Objects[mi]).id;
      exit;
    end;

  mPath := SplitString(sSanitized, '\/');
  sPath := TStringList.Create;
  for mi := 0 to Length(mPath) - 1 do
  begin
    if Trim(mPath[mi]) <> '' then
      sPath.Add(mPath[mi]);
  end;

  result := GetIDRecurse('', sPath, '', 0);
  sPath.free;
end;

procedure FindFiles(FilesList: TStringList; StartDir, FileMask: string; var filecount: Int64; var totalsize: Int64;
  Recurse: Boolean = True);
var
  SR: TSearchRec;
  DirList: TStringList;
  IsFound: Boolean;
  i: Integer;
  tfilecount, ttotalsize: Int64;
begin
  filecount := 0;
  totalsize := 0;
  if StartDir = '' then
    StartDir := '.\';

  if StartDir[Length(StartDir)] <> '\' then
    StartDir := StartDir + '\';

  { Build a list of the files in directory StartDir
    (not the directories!) }

  IsFound := System.SysUtils.FindFirst(StartDir + FileMask, faAnyFile - faDirectory, SR) = 0;
  while IsFound do
  begin
    FilesList.Add(StartDir + SR.Name);
    filecount := filecount + 1;
    totalsize := totalsize + SR.Size;
    IsFound := System.SysUtils.FindNext(SR) = 0;
  end;
  System.SysUtils.FindClose(SR);

  if Recurse then
  begin

    // Build a list of subdirectories
    DirList := TStringList.Create;
    IsFound := System.SysUtils.FindFirst(StartDir + '*.*', faAnyFile, SR) = 0;
    while IsFound do
    begin
      if ((SR.Attr and faDirectory) <> 0) and (SR.Name[1] <> '.') then
        DirList.Add(StartDir + SR.Name);
      IsFound := FindNext(SR) = 0;
    end;
    System.SysUtils.FindClose(SR);

    // Scan the list of subdirectories
    for i := 0 to DirList.Count - 1 do
    begin
      FindFiles(FilesList, DirList[i], FileMask, tfilecount, ttotalsize, Recurse);
      filecount := filecount + tfilecount;
      totalsize := totalsize + ttotalsize;
    end;

    DirList.free;

  end;

end;

function UploadSingleFile(odirname, fn: string; overwrite: Boolean = false): Boolean;

var
  Stream: TFileStream;
  NewFile: TElOneDriveFile;
  ParentDir: TElOneDriveFolder;
  Succeeded, skip: Boolean;
  i: Integer;
  sw: TStopWatch;

begin
  result := false;
  if not FileExists(fn) then
  begin
    Writeln('Error: file not found: ' + fn);
    exit;
  end;

  if ODFileExists('/' + odirname + ExtractFileName(fn)) and not overwrite then
  begin
    Writeln('File already exists, skipping: ' + fn);
    exit;
  end;

  try
    OneDrive.OnProgress := Event.DataStorageProgress;
    speed := 0;
    remain := '';
    swprogress := TStopWatch.Create;
    if Cached.Count = 0 then
    begin
      Writeln('Getting OneDrive folder names');
      GetFolderID(odirname);
    end;
    Writeln('Uploading ' + fn);
    Stream := TFileStream.Create(fn, fmOpenRead or fmShareDenyWrite);

    ParentDir := TElOneDriveFolder(GetODObjByIDOnly(GetFolderID(odirname)));

    skip := false;
    if ODFileExists('/' + odirname + ExtractFileName(fn)) and not overwrite then
    begin
      skip := True;
      // Writeln('File alredy exists, skipping');
      // exit;
    end;

    try
      NewFile := OneDrive.CreateObject(ParentDir, ExtractFileName(fn), overwrite);
    except
      on E: Exception do
      begin
        if E.Message.Contains('Code: resource_already_exists') and not overwrite then
        begin
          Writeln('File alredy exists, skipping');
          // Stream.free;
          // sw.free; ezmi
          skip := True;
        end;

      end;

    end;
    if not skip then
    begin
      sw := TStopWatch.Create();
      sw.Start;
      swprogress.Start;
      prevcount := 0;

      Succeeded := false;
      repeat
        try
          NewFile.Write(Stream);
          OneDrive.ReleaseObject(TElCustomDataStorageObject(NewFile));
          Succeeded := True;
        except
          on E: Exception do
          begin
            // on next try it will continue from current chunk if File size > ChunkedUploadThreshold otherwise it will start from begining
            Writeln('Upload failed. Error: ' + E.Message + ' - retrying');
          end;
        end;
      until Succeeded;
      if Stream.Size > OneDrive.ChunkedUploadChunkSize then
        for i := 0 to 80 do
          write(#$8);
      result := True;
      sw.Stop;
      speed := Stream.Size div sw.elapsedMilliseconds;
      sw.free;
      Writeln('Uploaded ok - ' + speed.ToString + ' kb/s' + '                                     ');
    end;

  finally
    OneDrive.OnProgress := nil;
    FreeAndNil(swprogress);
    FreeAndNil(Stream);
  end;
end;

procedure UploadFiles(What, Where: string; maxfilecount: Int64; maxtotalsize: Int64; overwrite: Boolean = false;
  Recurse: Boolean = True);
var
  filelist: TStringList;
  findpath, findmask, RelativeDir, FullName, FileName, OFolder: string;
  i: Integer;
  filecount, totalsize: Int64;
begin
  filelist := TStringList.Create;
  findpath := (ExtractFilePath(What));
  findmask := ExtractFileName(What);
  if DirectoryExists(findpath + findmask) then
  begin
    findpath := IncludeTrailingPathDelimiter(findpath + findmask);
    findmask := '*.*';
  end;

  Writeln('Looking for files to upload');
  FindFiles(filelist, findpath, findmask, filecount, totalsize, Recurse);
  Writeln('Total files: ' + inttostr(filecount) + ' Total size: ' + FormatByteSize(totalsize));

  if maxfilecount > 0 then
    if filecount > maxfilecount then
    begin
      Writeln('Max file count exceeded, exiting');
      exit;
    end;

  if maxtotalsize > 0 then
    if totalsize > maxtotalsize then
    begin
      Writeln('Max size exceeded, exiting');
      exit;
    end;

  OFolder := Where;
  if not OFolder.EndsWith('/') then
    OFolder := OFolder + '/';

  for i := 0 to filelist.Count - 1 do
  begin
    filelist[i] := StringReplace(filelist[i], findpath, '', [rfIgnoreCase]);
    RelativeDir := ExtractFilePath(filelist[i]);
    if RelativeDir = '.\' then
      RelativeDir := '';
    FullName := findpath + filelist[i];
    FileName := ExtractFileName(filelist[i]);
    Writeln('-----------------------------');
    if filelist.Count > 1 then
      Writeln('File ' + (i + 1).ToString() + '/' + filelist.Count.ToString());
    UploadSingleFile(OFolder + RelativeDir, FullName, overwrite);
  end;

  //
  FreeAndNil(filelist);
end;

var
  s, tdir, tname: string;
  cl: TCommandLine;

  /// ////////////////////////////////////////////
  ///
  /// Main
  ///
  /// ////////////////////////////////////////////

begin
  try
    cl := TCommandLine.Create;
    try
      if not CommandLineParser.Parse(cl) then
      begin
        for s in CommandLineParser.Usage do
          Writeln(s);
        exit;
      end;
    finally

    end;

  except
    on E: Exception do
    begin
      Writeln(E.ClassName, ': ', E.Message);
      exit;
    end;
  end;

  try
    { SetLicenseKey('41637FC52E251102492FD1FD7B9028DD039EFC0737235AB35F49500DFCAFA47E' + '30E0E7E64FA9EB7EDD0DA255AA76C3B0A30FD0C1E19EF081A6CBE0917F604EAA' +
      'EE5AEB735C6082E0AC457FD9D7BD7F7388F226A50935150A04CB6BB9E36B2FB6' + 'B283544292F8D89CF3A156849683FDF585DCE17CCBA6846F3AD1F62BCFEBA73B' +
      'F5AABC7DC20EBF3CE26223C5A0B48E5D10E941FA6142E414DFC4C903EFE2C8F8' + 'F7E836F2CD46423996BDBF3A722CEFBF54BBB5F9B8E16E90A108D058C64DC781' +
      'E75071606F5354B37B044A014DDE11CBCD2D29E44831557CC62CD449027BB37A' + '053F32762CD35FCE78483A5D7982AE234BC9D6DF901C67D507A71F52D11DF854');
    }
    SetLicenseKey
      ('AA6533A50A91B47E97DED2D311DD68D2A583188DD815EAD303D01F1671DA22D796D27C15AA4F64F8A63C310D2DDAAF718680C4BA7' +
      '1881A2CCFEF5962FBDA182D6F0F815C871CB5FC719E70FBC72C0FA3D8B9C56AF0446BED596C526960C74F72B0F5DD6AF658EEEFB95A127CF154459EACDE53'
      + '4750DDE1A7F5FE959F3AA57112DC695FD79B74B2B4E7897A409C675DD37AE69A59F052EDC79B25BB42526097BCF60FB29D1D3AE4BE0592EA0B475D2'
      + 'F838AEBB3D1F7144D8DAFAA62C8852B674395612C0894078601488B2F5D22A6A2125C7D1A6131DB2FAD71108BD2EAC0CCF567C2828A659C091898EE6'
      + '8B5C0CFD85424CE0837C7A9A7911B64F4688A4AFE08');

    { TODO -oUser -cConsole Main : Insert code here }
    Cached := TStringList.Create;

    Event := TEvents.Create;

    Transport := TElHTTPSClient.Create(nil);
    with Transport do
    begin
      Name := 'Transport';
      { SocketTimeout := 60000;
        Versions := [sbSSL3, sbTLS1]; }
      SendBufferSize := cl.PSendBuffer;
      { Use100Continue := False;
      }

      OnCertificateValidate := Event.TransportCertificateValidate;
    end;

    OneDrive := TElOneDriveDataStorage.Create(nil);
    with OneDrive do
    begin
      Name := 'OneDrive';
      HTTPClient := Transport;
    end;
    LoadSettings;
    ConnectExecute;

    if (cl.PMulti or cl.PSingle) and not cl.PQBT then // uTorrent Mode
    begin
      Writeln('uTorrent mode');
      if cl.PMulti then
      begin
        tdir := Copy(cl.Source, 1, cl.Source.IndexOf('/'));
        UploadFiles(tdir, cl.Destination, cl.RMaxCount, cl.RMaxSize, cl.POverwrite, not cl.PRecurse)
      end
      else
      begin
        UploadFiles(StringReplace(cl.Source, '/', '\', [rfReplaceAll]), cl.Destination, cl.RMaxCount, cl.RMaxSize,
          cl.POverwrite, not cl.PRecurse);
      end;
    end;

    if cl.PQBT then // qBittorent mode
    begin
      Writeln('qBittorent mode');
      Writeln('Source: ' + cl.Source);
      Writeln('Target: ' + cl.Destination);

      if cl.PMulti then
      begin
        UploadFiles(StringReplace(cl.Source, '/', '\', [rfReplaceAll]), cl.Destination, cl.RMaxCount, cl.RMaxSize,
          cl.POverwrite, not cl.PRecurse);
      end
      else
      begin // single
        tname := StringReplace(cl.Destination, ExtractFileName(StringReplace(cl.Source, '/', '\', [rfReplaceAll])
          ), '', []);
        Writeln('Singlefiledir: ' + tname);
        UploadFiles(StringReplace(cl.Source, '/', '\', [rfReplaceAll]), tname, cl.RMaxCount, cl.RMaxSize, cl.POverwrite,
          not cl.PRecurse);
      end;
    end;

    // no torrent mode
    if not cl.PMulti and not cl.PSingle and not cl.PQBT then
      UploadFiles(StringReplace(cl.Source, '/', '\', [rfReplaceAll]), cl.Destination, cl.RMaxCount, cl.RMaxSize,
        cl.POverwrite, not cl.PRecurse);

    // LoadQuotaInfo;

    // for i := 0 to Cached.Count - 1 do
    // Writeln(Cached[i] + ' - ' + TElOneDriveDataStorageObject(Cached.Objects[i]).id);

    // Writeln('ende');
    // Writeln('Total cached: ' + Cached.Count.ToString());
    if cl.PWait then
    begin
      Writeln('Press enter to exit');
      readln;
    end;
  except
    on E: Exception do
      Writeln(E.ClassName, ': ', E.Message);
  end;
  FreeAndNil(Cached);

end.
