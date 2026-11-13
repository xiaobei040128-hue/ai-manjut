import {siteInformation,siteInformationUrl} from './site-information';
import {company} from '../../shared/site-information.json';
import {useLanguage} from '../i18n/language';
import './company-footer.css';
export default function CompanyFooter(){
 const language=useLanguage(),data=siteInformation(language);
 const text={...data,support:data.contact};
 const companyLabel=data.companyLabel;
 return <footer className="s-company-footer"><div className="s-company-footer-links"><a href={siteInformationUrl('faq',language)}>{text.faq}</a><span aria-hidden="true">·</span><a href={siteInformationUrl('about',language)}>{text.about}</a><span aria-hidden="true">·</span><a href={siteInformationUrl('privacy',language)}>{data.privacy}</a><span aria-hidden="true">·</span><a href={'mailto:'+company.email}>{text.support}</a></div><p className="s-company-signature">AI CREATOR HUB LTD <span>· No. {company.number}</span></p><details className="s-company-details"><summary>{companyLabel}</summary><div><p>{text.identity}</p><p>{text.registered}: {company.registered}</p><p>{text.operating}: {company.operating}</p><p><a href={'mailto:'+company.email}>{company.email}</a></p></div></details></footer>;
}
