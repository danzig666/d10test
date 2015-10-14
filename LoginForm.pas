(******************************************************)
(*                                                    *)
(*            EldoS SecureBlackbox Library            *)
(*                                                    *)
(*      Copyright (c) 2002-2013 EldoS Corporation     *)
(*           http://www.secureblackbox.com            *)
(*                                                    *)
(******************************************************)

unit LoginForm;

interface

uses
  Windows, Messages, SysUtils, Classes, Graphics, Controls, Forms, Dialogs, OleCtrls, StdCtrls,
  // If you got the compiler error "File not found SHDocVw.dcu" in Delphi 5-7, please go to
  // Tools -> Environment Options -> Library; click the "..." button right to the "Library path"
  // edit box. In the edit box at the bottom of the Directories dialog enter
  // "$(DELPHI)\Source\Internet" (without quotes), then press Add -> OK -> OK.
  // Now the project should be compiled successfully.
  SHDocVw;

type
  ECancelAuthorization = class(Exception);
  TfrmLogin = class(TForm)
    lblWarning: TLabel;
    procedure FormCreate(Sender: TObject);
    procedure FormClose(Sender: TObject; var Action: TCloseAction);
    procedure BrowserNavigateComplete2(ASender: TObject; const pDisp: IDispatch;
      const URL: OleVariant);
  private
    FAuthorizationCode: string;
    FBrowser: TWebBrowser;
  public
    class procedure Execute(const AuthURL: string; out AuthorizationCode: string);
    property Browser: TWebBrowser read FBrowser;
  end;

implementation

{$R *.dfm}

uses
  SBStrUtils, SBEncoding;

{ TfrmLogin }

procedure TfrmLogin.BrowserNavigateComplete2(ASender: TObject; const pDisp: IDispatch;
  const URL: OleVariant);
var
  I: Integer;
  S: string;
begin
  S := URLDecode(URL);
  if Pos('https://login.live.com/oauth20_desktop.srf?', S) = 1 then
  begin
    FAuthorizationCode := '';

    while True do
    begin
      I := Pos('code=', S);
      if I = 0 then
        Break;

      if (I = 1) or ((S[I - 1] = '?') or (S[I - 1] = '&')) then
      begin
        FAuthorizationCode := Copy(S, I + 5, MaxInt);
        I := Pos('&', FAuthorizationCode);
        if I <> 0 then
          Delete(FAuthorizationCode, I, MaxInt);
        Break;
      end
      else
        Delete(S, 1, I + 5);
    end;

    ModalResult := mrOK;
  end;
end;

class procedure TfrmLogin.Execute(const AuthURL: string; out AuthorizationCode: string);
var
  Dialog: TfrmLogin;
begin
  Application.CreateForm(TfrmLogin, Dialog);
  Dialog.Browser.Navigate(AuthURL);
  if Dialog.ShowModal() = mrOK then
    AuthorizationCode := Dialog.FAuthorizationCode
  else
  begin
    raise ECancelAuthorization.Create('Authorization cancelled');
 /// Writeln('Authorization cancelled');
  end;
end;

procedure TfrmLogin.FormClose(Sender: TObject; var Action: TCloseAction);
begin
  if ModalResult = mrNone then
    ModalResult := mrCancel;
end;

procedure TfrmLogin.FormCreate(Sender: TObject);
begin
  FAuthorizationCode := '';
  FBrowser := TWebBrowser.Create(Self);
  InsertControl(FBrowser);
  FBrowser.Align := alClient;
  FBrowser.Silent := True;
  FBrowser.OnNavigateComplete2 := BrowserNavigateComplete2;
end;

end.
