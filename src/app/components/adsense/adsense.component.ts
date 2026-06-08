import { Component, Input, AfterViewInit, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-adsense',
  standalone: true,
  templateUrl: './adsense.component.html',
})
export class AdsenseComponent implements AfterViewInit {
  private platformId = inject(PLATFORM_ID);

  @Input() adClient: string = 'ca-pub-1434806838182674';
  @Input() adSlot: string = 'YYYYYYYYYY';
  @Input() adFormat: string = 'auto';
  @Input() fullWidthResponsive: string = 'true';

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        console.error('Error al inicializar AdSense:', e);
      }
    }
  }
}
