(******************************************************)
(*                                                    *)
(*            EldoS SecureBlackbox Library            *)
(*                                                    *)
(*      Copyright (c) 2002-2013 EldoS Corporation     *)
(*           http://www.secureblackbox.com            *)
(*                                                    *)
(******************************************************)

unit StartForm;

interface

uses
  Windows, Messages, SysUtils, Classes, Graphics, Controls, Forms, Dialogs, StdCtrls, ExtCtrls,
  ShellAPI;

type
  TfrmStart = class(TForm)
    lblWelcome: TLabel;
    Label2: TLabel;
    lblStep1: TLabel;
    lblStep2: TLabel;
    Label4: TLabel;
    Label5: TLabel;
    Label6: TLabel;
    Label7: TLabel;
    edtClientID: TEdit;
    Label8: TLabel;
    edtClientSecret: TEdit;
    Bevel1: TBevel;
    btnOK: TButton;
    Label1: TLabel;
    btnCancel: TButton;
    procedure FormCreate(Sender: TObject);
    procedure btnOKClick(Sender: TObject);
    procedure Label5Click(Sender: TObject);
  private
    { Private declarations }
  public
    class function Execute(var ClientID, ClientSecret: string): Boolean;
  end;

implementation

{$R *.dfm}

class function TfrmStart.Execute(var ClientID, ClientSecret: string): Boolean;
var
  Dialog: TfrmStart;
begin
  Application.CreateForm(TfrmStart, Dialog);
  try
    Dialog.edtClientID.Text := ClientID;
    Dialog.edtClientSecret.Text := ClientSecret;
    Result := (Dialog.ShowModal() = mrOk);
    if Result then
    begin
      ClientID := Dialog.edtClientID.Text;
      ClientSecret := Dialog.edtClientSecret.Text;
    end;
  finally
    FreeAndNil(Dialog);
  end;
end;

procedure TfrmStart.btnOKClick(Sender: TObject);
begin
  if edtClientID.Text = '' then
  begin
    MessageDlg('Client ID is required to use this demo', mtError, [mbOk], 0);
    ModalResult := mrNone;
    edtClientID.SetFocus();
    Exit;
  end;

  if edtClientSecret.Text = '' then
  begin
    MessageDlg('Client secret is required to use this demo', mtError, [mbOk], 0);
    ModalResult := mrNone;
    edtClientSecret.SetFocus();
    Exit;
  end;
end;

procedure TfrmStart.FormCreate(Sender: TObject);
begin
  Caption := Application.Title;

  lblWelcome.Caption := Format(lblWelcome.Caption, [Application.Title]);
  lblWelcome.Font.Size := lblWelcome.Font.Size + 2;
  lblWelcome.Font.Style := lblWelcome.Font.Style + [fsBold];

  lblStep1.Font.Style := lblWelcome.Font.Style + [fsBold];
  lblStep2.Font.Style := lblWelcome.Font.Style + [fsBold];
end;

procedure TfrmStart.Label5Click(Sender: TObject);
begin
  ShellExecute(0, 'open', 'https://account.live.com/developers/applications', nil, nil, SW_SHOW);
end;

end.
