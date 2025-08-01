import { 
  IsEmail, 
  IsString, 
  MinLength, 
  MaxLength, 
  IsOptional, 
  IsPhoneNumber,
  Matches,
  IsJWT,
  Length
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ 
    description: 'Email adresi', 
    example: 'user@example.com',
    format: 'email'
  })
  @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
  email: string;

  @ApiProperty({ 
    description: 'Şifre (en az 8 karakter, büyük harf, küçük harf, sayı ve özel karakter)', 
    example: 'Password123!',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { message: 'Şifre en az bir büyük harf, küçük harf, sayı ve özel karakter içermelidir' }
  )
  password: string;

  @ApiProperty({ 
    description: 'Ad', 
    example: 'Ahmet',
    maxLength: 50
  })
  @IsString()
  @MaxLength(50, { message: 'Ad en fazla 50 karakter olabilir' })
  firstName: string;

  @ApiProperty({ 
    description: 'Soyad', 
    example: 'Yılmaz',
    maxLength: 50
  })
  @IsString()
  @MaxLength(50, { message: 'Soyad en fazla 50 karakter olabilir' })
  lastName: string;

  @ApiPropertyOptional({ 
    description: 'Telefon numarası', 
    example: '+905551234567'
  })
  @IsOptional()
  @IsPhoneNumber('TR', { message: 'Geçerli bir telefon numarası giriniz' })
  phone?: string;

  @ApiPropertyOptional({ 
    description: 'Zaman dilimi', 
    example: 'Europe/Istanbul',
    default: 'UTC'
  })
  @IsOptional()
  @IsString()
  timezone?: string;

  @ApiPropertyOptional({ 
    description: 'Para birimi', 
    example: 'TRY',
    default: 'USD'
  })
  @IsOptional()
  @IsString()
  @Length(3, 3, { message: 'Para birimi 3 karakter olmalıdır' })
  currency?: string;
}

export class LoginDto {
  @ApiProperty({ 
    description: 'Email adresi', 
    example: 'user@example.com'
  })
  @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
  email: string;

  @ApiProperty({ 
    description: 'Şifre', 
    example: 'Password123!'
  })
  @IsString()
  password: string;

  @ApiPropertyOptional({ 
    description: '2FA kodu (eğer etkinse)', 
    example: '123456'
  })
  @IsOptional()
  @IsString()
  @Length(6, 6, { message: '2FA kodu 6 haneli olmalıdır' })
  twoFactorCode?: string;
}

export class ForgotPasswordDto {
  @ApiProperty({ 
    description: 'Email adresi', 
    example: 'user@example.com'
  })
  @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ 
    description: 'Email adresi', 
    example: 'user@example.com'
  })
  @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
  email: string;

  @ApiProperty({ 
    description: 'Şifre sıfırlama token\'ı', 
    example: 'abcd1234...'
  })
  @IsString()
  token: string;

  @ApiProperty({ 
    description: 'Yeni şifre', 
    example: 'NewPassword123!',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { message: 'Şifre en az bir büyük harf, küçük harf, sayı ve özel karakter içermelidir' }
  )
  newPassword: string;
}

export class ChangePasswordDto {
  @ApiProperty({ 
    description: 'Mevcut şifre', 
    example: 'CurrentPassword123!'
  })
  @IsString()
  currentPassword: string;

  @ApiProperty({ 
    description: 'Yeni şifre', 
    example: 'NewPassword123!',
    minLength: 8
  })
  @IsString()
  @MinLength(8, { message: 'Şifre en az 8 karakter olmalıdır' })
  @Matches(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    { message: 'Şifre en az bir büyük harf, küçük harf, sayı ve özel karakter içermelidir' }
  )
  newPassword: string;
}

export class VerifyEmailDto {
  @ApiProperty({ 
    description: 'Email adresi', 
    example: 'user@example.com'
  })
  @IsEmail({}, { message: 'Geçerli bir email adresi giriniz' })
  email: string;

  @ApiProperty({ 
    description: 'Doğrulama token\'ı', 
    example: 'abcd1234...'
  })
  @IsString()
  token: string;
}

export class Enable2FADto {
  @ApiProperty({ 
    description: 'Şifre doğrulaması', 
    example: 'Password123!'
  })
  @IsString()
  password: string;
}

export class Verify2FADto {
  @ApiProperty({ 
    description: '2FA kodu', 
    example: '123456'
  })
  @IsString()
  @Length(6, 6, { message: '2FA kodu 6 haneli olmalıdır' })
  code: string;
}

export class RefreshTokenDto {
  @ApiProperty({ 
    description: 'Refresh token', 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  @IsString()
  @IsJWT({ message: 'Geçerli bir JWT token giriniz' })
  refreshToken: string;
}

export class LogoutDto {
  @ApiProperty({ 
    description: 'Refresh token', 
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  @IsString()
  @IsJWT({ message: 'Geçerli bir JWT token giriniz' })
  refreshToken: string;
}

// Response DTOs
export class AuthResponseDto {
  @ApiProperty({ description: 'Kullanıcı bilgileri' })
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    isVerified: boolean;
    twoFactorEnabled: boolean;
  };

  @ApiProperty({ description: 'Access token' })
  accessToken: string;

  @ApiProperty({ description: 'Refresh token' })
  refreshToken: string;

  @ApiPropertyOptional({ description: '2FA gerekli mi?' })
  requiresTwoFactor?: boolean;
}

export class MessageResponseDto {
  @ApiProperty({ description: 'Sonuç mesajı' })
  message: string;
}

export class VerificationResponseDto {
  @ApiProperty({ description: 'Sonuç mesajı' })
  message: string;

  @ApiProperty({ description: 'Doğrulama token\'ı' })
  verificationToken: string;
}

export class TwoFactorSetupResponseDto {
  @ApiProperty({ description: 'QR kod URL\'i' })
  qrCodeUrl: string;

  @ApiProperty({ description: 'Gizli anahtar' })
  secret: string;
}

export class TokenRefreshResponseDto {
  @ApiProperty({ description: 'Yeni access token' })
  accessToken: string;

  @ApiProperty({ description: 'Yeni refresh token' })
  refreshToken: string;
}