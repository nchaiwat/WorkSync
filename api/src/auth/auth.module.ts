import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';

import { SettingsModule } from '../settings/settings.module';
import { TransactionLogsModule } from '../transaction-logs/transaction-logs.module';
import { CiamSsoService } from './ciam-sso.service';
import { CiamSsoController } from './ciam-sso.controller';

@Module({
  imports: [
    UsersModule,
    ConfigModule,
    SettingsModule,
    TransactionLogsModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'worksync_super_secret_jwt_key_999888',
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthService, JwtStrategy, CiamSsoService],
  controllers: [AuthController, CiamSsoController],
  exports: [AuthService, CiamSsoService],
})
export class AuthModule {}

