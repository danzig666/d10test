object frmLogin: TfrmLogin
  Left = 204
  Top = 169
  BorderStyle = bsDialog
  Caption = 'Login to OneDrive'
  ClientHeight = 451
  ClientWidth = 647
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  Position = poMainFormCenter
  OnClose = FormClose
  OnCreate = FormCreate
  PixelsPerInch = 96
  TextHeight = 13
  object lblWarning: TLabel
    Left = 0
    Top = 0
    Width = 647
    Height = 451
    Align = alClient
    Alignment = taCenter
    Caption = 
      'This form will contain an embedded web browser control wich is c' +
      'reated at runtime. This is done this way due to differences in D' +
      'elphi standard packages (in Delphi 5-7).'
    Layout = tlCenter
    WordWrap = True
    ExplicitWidth = 637
    ExplicitHeight = 26
  end
end
