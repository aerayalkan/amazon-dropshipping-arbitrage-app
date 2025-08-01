import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { User } from './user.entity';

@Entity('user_settings')
export class UserSettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  // Amazon API Settings
  @Column({ nullable: true })
  @Exclude()
  amazonAccessKey?: string;

  @Column({ nullable: true })
  @Exclude()
  amazonSecretKey?: string;

  @Column({ nullable: true })
  amazonAssociateTag?: string;

  @Column({ default: 'www.amazon.com' })
  amazonMarketplace: string;

  @Column({ nullable: true })
  amazonSellerId?: string;

  @Column({ nullable: true })
  @Exclude()
  amazonMwsAuthToken?: string;

  // Notification Settings
  @Column({ default: true })
  notificationEmail: boolean;

  @Column({ default: false })
  notificationSms: boolean;

  @Column({ default: true })
  notificationPush: boolean;

  // General Settings
  @Column({ default: 'UTC' })
  timezone: string;

  @Column({ default: 'USD' })
  currency: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, user => user.settings)
  @JoinColumn({ name: 'userId' })
  user: User;
}