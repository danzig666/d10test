object frmStart: TfrmStart
  Left = 221
  Top = 160
  BorderStyle = bsDialog
  Caption = 'Connect OneDrive'
  ClientHeight = 366
  ClientWidth = 411
  Color = clBtnFace
  Font.Charset = DEFAULT_CHARSET
  Font.Color = clWindowText
  Font.Height = -11
  Font.Name = 'Tahoma'
  Font.Style = []
  OldCreateOrder = False
  Position = poMainFormCenter
  OnCreate = FormCreate
  DesignSize = (
    411
    366)
  PixelsPerInch = 96
  TextHeight = 13
  object lblWelcome: TLabel
    Left = 15
    Top = 14
    Width = 79
    Height = 13
    Caption = 'Welcome to %s!'
  end
  object Label2: TLabel
    Left = 15
    Top = 45
    Width = 353
    Height = 52
    Anchors = [akLeft, akTop, akRight]
    Caption = 
      'Before you can use TElOneDriveDataStorage component, you require' +
      'd to register a new application on OneDrive site. If you already' +
      ' have a registered application and want to use its credentials, ' +
      'you are welcome to bypass step 1 and enter the credentials in th' +
      'e fields below.'
    WordWrap = True
  end
  object lblStep1: TLabel
    Left = 15
    Top = 108
    Width = 173
    Height = 13
    Caption = '1. Register a new app on OneDrive:'
  end
  object lblStep2: TLabel
    Left = 15
    Top = 241
    Width = 177
    Height = 13
    Caption = '2. Enter your application credentials:'
  end
  object Label4: TLabel
    Left = 27
    Top = 127
    Width = 281
    Height = 13
    Caption = 'a) Click the link, login with YOUR user name and password:'
  end
  object Label5: TLabel
    Left = 41
    Top = 146
    Width = 234
    Height = 13
    Cursor = crHandPoint
    Caption = 'Live Connect Developer Center - My Applications'
    Font.Charset = DEFAULT_CHARSET
    Font.Color = clWindowText
    Font.Height = -11
    Font.Name = 'Tahoma'
    Font.Style = [fsUnderline]
    ParentFont = False
    OnClick = Label5Click
  end
  object Label6: TLabel
    Left = 26
    Top = 165
    Width = 324
    Height = 26
    Anchors = [akLeft, akTop, akRight]
    Caption = 
      'b) Click "Create application" link, then enter "Application name' +
      '" and select its "Language". Then click "I accept" button.'
    WordWrap = True
  end
  object Label7: TLabel
    Left = 53
    Top = 263
    Width = 45
    Height = 13
    Caption = 'Client ID:'
  end
  object Label8: TLabel
    Left = 34
    Top = 290
    Width = 64
    Height = 13
    Caption = 'Client secret:'
  end
  object Bevel1: TBevel
    Left = 1
    Top = 325
    Width = 409
    Height = 2
    Anchors = [akLeft, akRight, akBottom]
  end
  object Label1: TLabel
    Left = 27
    Top = 197
    Width = 368
    Height = 26
    Caption = 
      'c) On the next screen choose "Yes" for "Mobile client app" state' +
      'ment. This is required for successful authorization.'
    WordWrap = True
  end
  object edtClientID: TEdit
    Left = 104
    Top = 260
    Width = 291
    Height = 21
    TabOrder = 0
  end
  object edtClientSecret: TEdit
    Left = 104
    Top = 287
    Width = 291
    Height = 21
    TabOrder = 1
  end
  object btnOK: TButton
    Left = 247
    Top = 333
    Width = 75
    Height = 25
    Anchors = [akRight, akBottom]
    Caption = 'OK'
    Default = True
    ModalResult = 1
    TabOrder = 2
    OnClick = btnOKClick
  end
  object btnCancel: TButton
    Left = 328
    Top = 333
    Width = 75
    Height = 25
    Cancel = True
    Caption = 'Cancel'
    ModalResult = 2
    TabOrder = 3
  end
end
