// ============================================================
// SkyGlobal Partner Agent Application — Google Apps Script
// ============================================================
// 이 파일은 참조용입니다. Google Apps Script 에디터에 복붙하세요.
// ============================================================

function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Sheet1')
      || SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

    var data = JSON.parse(e.postData.contents);

    // 시트에 데이터 추가
    sheet.appendRow([
      new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), // Timestamp
      data.route || '',
      data.companyName || '',
      data.businessNumber || '',
      data.recruitmentCountries || '',
      data.firstName || '',
      data.lastName || '',
      data.position || '',
      data.phoneCountryCode || '',
      data.phoneNumber || '',
      data.email || '',
      data.officeAddress || '',
      data.website || '',
      data.universityPartnerships || '',
      data.declaration || ''
    ]);

    // 자동 응답 이메일 발송
    if (data.email) {
      sendWelcomeEmail(data);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ result: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ result: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function sendWelcomeEmail(data) {
  var name = (data.firstName || '') + ' ' + (data.lastName || '');
  var company = data.companyName || '';

  var subject = 'Welcome to SkyGlobal Partner Network — Application Received';

  var htmlBody = '<!DOCTYPE html>'
    + '<html><head><meta charset="utf-8"></head>'
    + '<body style="font-family:Arial,sans-serif;line-height:1.6;color:#333;max-width:600px;margin:0 auto;padding:20px;">'
    + '<div style="text-align:center;margin-bottom:30px;">'
    + '<h1 style="color:#23508e;margin-bottom:5px;">SkyGlobal</h1>'
    + '<p style="color:#666;font-size:14px;">Partner Network</p>'
    + '</div>'
    + '<p>Dear <strong>' + name.trim() + '</strong>,</p>'
    + '<p>Thank you for your interest in partnering with <strong>SkyGlobal</strong>.</p>'
    + '<p>We have successfully received your Partner Agent application from <strong>' + company + '</strong>. '
    + 'Our team will review your application and get back to you within <strong>3–5 business days</strong>.</p>'
    + '<h3 style="color:#23508e;border-bottom:2px solid #23508e;padding-bottom:8px;">What happens next?</h3>'
    + '<ol>'
    + '<li><strong>Application Review</strong> — Our partnership team will evaluate your application.</li>'
    + '<li><strong>Verification</strong> — We may reach out for additional documentation.</li>'
    + '<li><strong>Onboarding</strong> — Once approved, you will receive your partner credentials and access to our university network.</li>'
    + '</ol>'
    + '<p>If you have any questions in the meantime, please don\'t hesitate to contact us at '
    + '<a href="mailto:info@skyglobalstudy.com" style="color:#23508e;">info@skyglobalstudy.com</a>.</p>'
    + '<br>'
    + '<p>Best regards,<br><strong>SkyGlobal Partnership Team</strong></p>'
    + '<hr style="border:none;border-top:1px solid #eee;margin:30px 0;">'
    + '<p style="font-size:12px;color:#999;text-align:center;">'
    + '© ' + new Date().getFullYear() + ' SkyGlobal. All rights reserved.</p>'
    + '</body></html>';

  // PDF 첨부 필요 시 아래 주석 해제하고 FILE_ID를 실제 Google Drive 파일 ID로 교체
  // var pdfFile = DriveApp.getFileById('YOUR_PDF_FILE_ID');
  // var options = {
  //   htmlBody: htmlBody,
  //   attachments: [pdfFile.getAs(MimeType.PDF)]
  // };

  var options = {
    htmlBody: htmlBody,
    from: 'info@skyglobalstudy.com',
    replyTo: 'info@skyglobalstudy.com',
    name: 'SkyGlobal'
  };

  GmailApp.sendEmail(data.email, subject, '', options);
}

// 테스트용 함수 — Apps Script 에디터에서 실행해서 이메일 테스트 가능
function testEmail() {
  sendWelcomeEmail({
    firstName: 'Test',
    lastName: 'User',
    companyName: 'Test Company',
    email: 'YOUR_TEST_EMAIL@gmail.com'  // 본인 이메일로 변경
  });
}
