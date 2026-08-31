import {
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export interface StorageOptions {
  endpoint: string;
  accessKey: string;
  secretKey: string;
  bucket: string;
  secure: boolean;
}

/** MinIO/S3 兼容对象存储；key = {name}/{version}/{sha256}.zip（内容寻址） */
export class StorageService {
  private readonly client: S3Client;
  readonly bucket: string;

  constructor(opts: StorageOptions) {
    this.bucket = opts.bucket;
    this.client = new S3Client({
      endpoint: `${opts.secure ? 'https' : 'http'}://${opts.endpoint}`,
      region: 'us-east-1',
      forcePathStyle: true,
      credentials: { accessKeyId: opts.accessKey, secretAccessKey: opts.secretKey },
    });
  }

  static packageKey(skillName: string, version: string, sha256: string): string {
    return `${skillName}/${version}/${sha256}.zip`;
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      } catch {
        /* 已存在或不可达；上传时再报错 */
      }
    }
  }

  async putPackage(key: string, data: Uint8Array): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: 'application/zip',
      }),
    );
  }

  async getPackage(key: string): Promise<Uint8Array | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      if (!res.Body) return null;
      return new Uint8Array(await res.Body.transformToByteArray());
    } catch {
      return null;
    }
  }
}
