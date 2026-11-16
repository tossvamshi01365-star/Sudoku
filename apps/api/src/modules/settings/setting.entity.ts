import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** One editable contest setting (brand name, prize amounts, switches...). Values are JSON. */
@Entity({ name: 'settings' })
export class SettingEntity {
  @PrimaryColumn({ type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'jsonb' })
  value: unknown;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
