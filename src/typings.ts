export interface CategoryResult {
  name: string;
  url: string;
}

export class Category {
  results: CategoryResult[];
  totalResult: number;
}

export interface DownloadPage extends CategoryResult {
  category: string;
}
