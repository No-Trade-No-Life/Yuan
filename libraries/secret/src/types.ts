/**
 * Arbitrary secret data storage interface
 *
 * @public
 */
export interface ISecret {
  /**
   * Signature of the secret record (signer + reader + tags + data) (Primary Key)
   */
  sign: string;
  /**
   * Public key of the signer of the secret record (Indexed)
   */
  signer: string;
  /**
   * Public key of the reader authorized to decrypt the secret data (Indexed)
   */
  reader: string;
  /**
   * JSONB object of tags (GIN indexed)
   */
  tags: Record<string, string>;
  /**
   * Base64 encoded encrypted data
   */
  data: string;
}
