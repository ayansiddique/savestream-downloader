import { Helmet } from 'react-helmet-async';

export default function FAQ() {
  return (
    <div className="container">
      <Helmet>
        <title>FAQ - SaveStream Video Downloader</title>
        <meta name="description" content="Frequently Asked Questions about SaveStream video downloader. Learn supported formats, websites, audio extraction and resolution capabilities." />
      </Helmet>

      <section className="faq-section" style={{ marginTop: '2rem' }}>
        <h1 className="section-title">Frequently Asked Questions</h1>
        <div className="faq-item">
          <div className="faq-question">What websites are supported?</div>
          <div className="faq-answer">We support over 1000+ websites including YouTube, TikTok, Facebook, Instagram, Twitter/X, Reddit, Vimeo, and more.</div>
        </div>
        <div className="faq-item">
          <div className="faq-question">Is it possible to download audio only?</div>
          <div className="faq-answer">Yes! After fetching the video, simply switch to the "Audio (.mp3)" tab to download the extracted audio in high quality.</div>
        </div>
        <div className="faq-item">
          <div className="faq-question">Do you support downloading 1080p and 4K?</div>
          <div className="faq-answer">Absolutely. We automatically extract and list all available resolutions up to 4K, including formats with or without audio.</div>
        </div>
      </section>
    </div>
  );
}
